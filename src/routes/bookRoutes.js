import express from "express";
import cloudinary from "../lib/cloudinary.js";
import protectRoute from "../middleware/auth.middleware.js";
import Book from "../models/Book.js";

const router = express.Router();

// create a book
router.post("/", protectRoute, async (req, res) => {
  try {
    const { title, caption, rating, image } = req.body;

    if (!title || !caption || !rating || !image) {
      return res.status(400).json({ message: "Please provide all fields" });
    }

    // upload image to cloudinary
    const uploadResponse = await cloudinary.uploader.upload(image);
    const imageUrl = uploadResponse.secure_url;

    // save book in database
    const newBook = new Book({
      title,
      caption,
      rating,
      image: imageUrl,
      user: req.user._id,
    });

    await newBook.save();
    res.status(201).json(newBook);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

// get all books
router.get("/", protectRoute, async (req, res) => {
  try {
    const page = req.query.page || 1;
    const limit = req.query.limit || 10;
    const skip = (page - 1) * limit;

    // get all books from database
    const books = await Book.find()
      .sort({ createdAt: -1 }) // sort by newest first
      .skip(skip)
      .limit(limit)
      .populate("user", "username profileImage"); // populate user field with username and image

    // send response
    res.send({
      books,
      currentPage: page,
      totalBooks: await Book.countDocuments(),
      totalPages: Math.ceil((await Book.countDocuments()) / limit),
    });


  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
});

// delete a book
router.delete("/:id", protectRoute, async (req, res) => {
    try{
        const book =  await Book.findById(req.params.id);

        if(!book){
            return res.status(404).json({ message: "Book not found" });
        }

        // check if the user is the owner of the book
        if(book.user.toString() !== req.user._id.toString()){
            return res.status(401).json({ message: "You are not authorized to delete this book" });
        }

        // delete image from cloudinary
        if(book.image && book.image.includes("cloudinary")){
            try{
                const publicId = book.image.split("/").pop().split(".")[0];
                await cloudinary.uploader.destroy(publicId);
            }catch(deleteError){
                console.error("Error deleting image from Cloudinary:", deleteError);
            }
        }
        // delete the book
        await book.deleteOne();
        res.status(200).json({ message: "Book deleted successfully" });


    }catch(error){
        res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
});

// get reccomended books
router.get("/user", protectRoute, async (req, res) => {
    try{
        const books = await Book.find({ user: req.user._id }).sort({ createdAt: -1 });
        res.status(200).json({ books });
        
    }catch(error){
        res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
})

export default router;
