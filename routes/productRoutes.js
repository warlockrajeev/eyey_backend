import express from "express";
import {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  bulkUploadProducts,
  downloadCSVTemplate,
  bulkUploadImages,
} from "../controllers/productController.js";
import { adminAuth } from "../middleware/adminAuth.js";
import upload from "../middleware/upload.js"; // Import the configured multer upload middleware

const router = express.Router();

// Bulk upload routes - place before other routes to avoid conflicts
router.post(
  "/bulk-upload",
  adminAuth,
  upload.single("csvFile"),
  bulkUploadProducts
);
router.post(
  "/bulk-upload-images",
  adminAuth,
  upload.array("images", 50),
  bulkUploadImages
);
router.get("/csv-template", adminAuth, downloadCSVTemplate);

// Admin routes
router
  .route("/") // Changed from "/admin/products" to "/"
  .post(
    adminAuth,
    upload.fields([
      { name: "images", maxCount: 4 },
      { name: "tryOnImage", maxCount: 1 },
    ]),
    createProduct
  ) // Re-added adminAuth and removed temporary console.log
  .get(getProducts); // Restored original getProducts

router
  .route("/:id") // Changed from "/admin/products/:id" to "/:id"
  .get(getProductById)
  .put(
    adminAuth,
    upload.fields([
      { name: "images", maxCount: 4 },
      { name: "tryOnImage", maxCount: 1 },
    ]),
    updateProduct
  )
  .delete(adminAuth, deleteProduct);

export default router;
