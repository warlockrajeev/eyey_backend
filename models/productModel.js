import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Please enter product name"],
    trim: true,
  },
  description: {
    type: String,
    required: [true, "Please enter product description"],
  },
  price: {
    type: Number,
    required: [true, "Please enter product price"],
    maxLength: [8, "Price cannot exceed 8 characters"],
  },
  frameDimensions: {
    type: String,
  },
  productInformation: {
    type: String,
  },
  images: [
    {
      public_id: {
        type: String,
        required: true,
      },
      url: {
        type: String,
        required: true,
      },
    },
  ],
  category: {
    type: String,
    required: [true, "Please enter product category"],
  },
  stock: {
    type: Number,
    required: [true, "Please enter product stock"],
    maxLength: [4, "Stock cannot exceed 4 characters"],
    default: 1,
  },
  newArrival: {
    type: Boolean,
    default: false,
  },
  hotSeller: {
    type: Boolean,
    default: false,
  },
  men: {
    type: Boolean,
    default: false,
  },
  women: {
    type: Boolean,
    default: false,
  },
  kids: {
    type: Boolean,
    default: false,
  },
  brand: {
    type: String,
    default: "",
  },
  sellerName: {
    type: String,
    default: "",
  },
  sellerRating: {
    type: Number,
    default: 0,
  },
  deliveryTimeline: {
    type: String,
    default: "",
  },
  tryOnImage: {
    public_id: {
      type: String,
    },
    url: {
      type: String,
    },
  },

  user: {
    type: mongoose.Schema.ObjectId,
    ref: "User",
  },
  vendor: {
    type: mongoose.Schema.ObjectId,
    ref: "Vendor",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Product = mongoose.model("Product", productSchema);

export default Product;
