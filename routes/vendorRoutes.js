import express from "express";
import {
    registerVendor,
    loginVendor,
    getCurrentVendor,
    logoutVendor,
} from "../controllers/vendorController.js";
import { vendorAuth } from "../middleware/vendorAuth.js";

const router = express.Router();

// Public routes
router.post("/register", registerVendor);
router.post("/login", loginVendor);
router.post("/logout", logoutVendor);

// Protected routes (vendor must be logged in)
router.get("/me", vendorAuth, getCurrentVendor);

// Dashboard stats
import {
    getVendorSummary,
    getVendorProducts,
    createVendorProduct,
    updateVendorProduct,
    deleteVendorProduct,
    getVendorOrders,
    updateVendorOrderStatus,
    getVendorProfile,
    updateVendorProfile,
    getVendorReviews,
    getVendorEarningsSummary,
    getVendorEarningsHistory
} from "../controllers/vendorDashboardController.js";

router.get("/dashboard/summary", vendorAuth, getVendorSummary);

// Profile management
router.get("/profile", vendorAuth, getVendorProfile);
router.put("/profile", vendorAuth, updateVendorProfile);

// Reviews management
router.get("/reviews", vendorAuth, getVendorReviews);

// Earnings management
router.get("/earnings/summary", vendorAuth, getVendorEarningsSummary);
router.get("/earnings/history", vendorAuth, getVendorEarningsHistory);

import upload from "../middleware/upload.js";

// Product management
router.get("/products", vendorAuth, getVendorProducts);
router.post(
  "/products",
  vendorAuth,
  upload.fields([
    { name: "images", maxCount: 4 },
    { name: "tryOnImage", maxCount: 1 },
  ]),
  createVendorProduct
);
router.put(
  "/products/:id",
  vendorAuth,
  upload.fields([
    { name: "images", maxCount: 4 },
    { name: "tryOnImage", maxCount: 1 },
  ]),
  updateVendorProduct
);
router.delete("/products/:id", vendorAuth, deleteVendorProduct);

// Order management
router.get("/orders", vendorAuth, getVendorOrders);
router.put("/orders/:id/status", vendorAuth, updateVendorOrderStatus);

export default router;
