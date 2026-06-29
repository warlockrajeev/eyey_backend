import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { v2 as cloudinary } from "cloudinary";
import Product from "../models/productModel.js";
import Order from "../models/orderModel.js";
import Vendor from "../models/vendorModel.js";
import Review from "../models/reviewModel.js";
import mongoose from "mongoose";

/**
 * @desc    Get vendor profile details
 * @route   GET /api/vendor/profile
 * @access  Protected (vendorAuth)
 */
export const getVendorProfile = async (req, res) => {
    try {
        const vendor = await Vendor.findById(req.vendor._id).select("-password -role");
        if (!vendor) {
            return res.status(404).json({ message: "Vendor not found." });
        }
        res.status(200).json(vendor);
    } catch (error) {
        console.error("❌ Get vendor profile error:", error);
        res.status(500).json({ message: "Server error." });
    }
};

/**
 * @desc    Update vendor profile
 * @route   PUT /api/vendor/profile
 * @access  Protected (vendorAuth)
 */
export const updateVendorProfile = async (req, res) => {
    try {
        const { mobile, address, bankDetails } = req.body;

        // Find and update vendor
        // Only allow specific fields to be updated
        const vendor = await Vendor.findById(req.vendor._id);

        if (!vendor) {
            return res.status(404).json({ message: "Vendor not found." });
        }

        if (mobile) vendor.mobile = mobile;
        if (address) vendor.address = address;
        if (bankDetails) {
            vendor.bankDetails = {
                ...vendor.bankDetails,
                ...bankDetails
            };
        }

        await vendor.save();

        const updatedVendor = vendor.toObject();
        delete updatedVendor.password;

        res.status(200).json({
            message: "Profile updated successfully.",
            vendor: updatedVendor
        });
    } catch (error) {
        console.error("❌ Update vendor profile error:", error);
        res.status(500).json({ message: "Server error." });
    }
};

/**
 * @desc    Get reviews for vendor's products
 * @route   GET /api/vendor/reviews
 * @access  Protected (vendorAuth)
 */
export const getVendorReviews = async (req, res) => {
    try {
        const vendorId = req.vendor._id;
        const reviews = await Review.find({ vendorId })
            .populate("productId", "name images")
            .populate("userId", "name")
            .sort("-createdAt");

        // Calculate average rating
        const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
        const averageRating = reviews.length > 0 ? (totalRating / reviews.length).toFixed(1) : 0;

        res.status(200).json({
            reviews,
            averageRating: parseFloat(averageRating),
            totalReviews: reviews.length
        });
    } catch (error) {
        console.error("❌ Get vendor reviews error:", error);
        res.status(500).json({ message: "Server error." });
    }
};

/**
 * @desc    Get earnings summary for vendor
 * @route   GET /api/vendor/earnings/summary
 * @access  Protected (vendorAuth)
 */
export const getVendorEarningsSummary = async (req, res) => {
    try {
        const vendorId = req.vendor._id;

        // We calculate earnings based on delivered orders
        const deliveredOrders = await Order.find({
            "items.vendor": vendorId,
            status: "delivered"
        });

        let totalRevenue = 0;
        deliveredOrders.forEach(order => {
            order.items.forEach(item => {
                if (item.vendor.toString() === vendorId.toString()) {
                    totalRevenue += item.price * item.quantity;
                }
            });
        });

        const commissionRate = 0.10; // 10% marketplace fee
        const totalCommission = totalRevenue * commissionRate;
        const netEarnings = totalRevenue - totalCommission;

        // For now, simpler logic for pending/paid
        // In a real system, these would come from a Payout model
        const pendingPayout = netEarnings; // Assume all is pending if not paid
        const paidAmount = 0;

        res.status(200).json({
            totalRevenue,
            totalCommission,
            netEarnings,
            pendingPayout,
            paidAmount,
            currency: "INR"
        });
    } catch (error) {
        console.error("❌ Get vendor earnings summary error:", error);
        res.status(500).json({ message: "Server error." });
    }
};

/**
 * @desc    Get earnings history (order by order)
 * @route   GET /api/vendor/earnings/history
 * @access  Protected (vendorAuth)
 */
export const getVendorEarningsHistory = async (req, res) => {
    try {
        const vendorId = req.vendor._id;

        // Fetch orders containing vendor's items
        const orders = await Order.find({ "items.vendor": vendorId }).sort("-createdAt");

        const history = orders.map(order => {
            let vendorTotal = 0;
            order.items.forEach(item => {
                if (item.vendor.toString() === vendorId.toString()) {
                    vendorTotal += item.price * item.quantity;
                }
            });

            const commission = vendorTotal * 0.10;
            const netEarning = vendorTotal - commission;

            return {
                orderId: order.orderId || order._id,
                totalAmount: vendorTotal,
                commissionAmount: commission,
                vendorEarning: netEarning,
                status: order.status,
                date: order.createdAt
            };
        });

        res.status(200).json(history);
    } catch (error) {
        console.error("❌ Get vendor earnings history error:", error);
        res.status(500).json({ message: "Server error." });
    }
};

/**
 * @desc    Get vendor dashboard summary (Stats)
 * @route   GET /api/vendor/dashboard/summary
 * @access  Protected (vendorAuth)
 */
export const getVendorSummary = async (req, res) => {
    try {
        const vendorId = req.vendor._id;

        // 1. Total Products
        const totalProducts = await Product.countDocuments({ vendor: vendorId });

        // 2. All orders containing this vendor's items
        const vendorOrders = await Order.find({ "items.vendor": vendorId });

        // 3. Pending Orders (Pending or Processing status)
        const pendingOrders = vendorOrders.filter(order =>
            ["pending", "processing", "confirmed"].includes(order.status)
        ).length;

        // 4. Total Revenue (Delivered items only)
        // Note: For multi-vendor orders, we only sum the total of THIS vendor's items
        let totalRevenue = 0;
        vendorOrders.forEach(order => {
            if (order.status === "delivered") {
                order.items.forEach(item => {
                    if (item.vendor.toString() === vendorId.toString()) {
                        totalRevenue += item.price * item.quantity;
                    }
                });
            }
        });

        res.status(200).json({
            totalProducts,
            totalOrders: vendorOrders.length,
            totalRevenue,
            pendingOrders
        });
    } catch (error) {
        console.error("❌ Get vendor summary error:", error);
        res.status(500).json({ message: "Server error." });
    }
};

/**
 * @desc    Get all products belonging to the logged-in vendor
 * @route   GET /api/vendor/products
 * @access  Protected (vendorAuth)
 */
export const getVendorProducts = async (req, res) => {
    try {
        const products = await Product.find({ vendor: req.vendor._id }).sort("-createdAt");
        res.status(200).json(products);
    } catch (error) {
        console.error("❌ Get vendor products error:", error);
        res.status(500).json({ message: "Server error." });
    }
};

/**
 * @desc    Create a new product as a vendor
 * @route   POST /api/vendor/products
 * @access  Protected (vendorAuth)
 */
export const createVendorProduct = async (req, res) => {
    try {
        const imageFiles = req.files && req.files["images"] ? req.files["images"] : [];
        const images = [];
        if (imageFiles.length > 0) {
            for (const file of imageFiles) {
                const result = await uploadOnCloudinary(file.path);
                if (result) {
                    images.push({
                        public_id: result.public_id,
                        url: result.url
                    });
                }
            }
        }

        const productData = {
            ...req.body,
            images,
            vendor: req.vendor._id,
            sellerName: req.vendor.businessName // Sync sellerName for frontend display
        };

        // Handle tryOnImage upload for vendor
        const tryOnFiles = req.files && req.files["tryOnImage"] ? req.files["tryOnImage"] : [];
        if (tryOnFiles.length > 0) {
            const tryOnFile = tryOnFiles[0];
            const result = await uploadOnCloudinary(tryOnFile.path);
            if (result) {
                productData.tryOnImage = {
                    public_id: result.public_id,
                    url: result.url
                };
            }
        }

        const product = await Product.create(productData);
        res.status(201).json(product);
    } catch (error) {
        console.error("❌ Create vendor product error:", error);
        if (error.name === "ValidationError") {
            const messages = Object.values(error.errors).map((e) => e.message);
            return res.status(400).json({ message: messages.join(", ") });
        }
        res.status(500).json({ message: "Server error." });
    }
};

/**
 * @desc    Update a vendor's product
 * @route   PUT /api/vendor/products/:id
 * @access  Protected (vendorAuth)
 */
export const updateVendorProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);

        if (!product) {
            return res.status(404).json({ message: "Product not found." });
        }

        // Security Check: Ensure vendor owns this product
        if (product.vendor.toString() !== req.vendor._id.toString()) {
            return res.status(403).json({ message: "Not authorized to update this product." });
        }

        // Handle Image Updates
        const imageFiles = req.files && req.files["images"] ? req.files["images"] : [];
        if (imageFiles.length > 0) {
            // Delete old images from Cloudinary
            if (product.images && product.images.length > 0) {
                for (const image of product.images) {
                    try {
                        await cloudinary.uploader.destroy(image.public_id);
                    } catch (err) {
                        console.error(`Failed to delete old image ${image.public_id} from Cloudinary:`, err);
                    }
                }
            }

            const newImages = [];
            for (const file of imageFiles) {
                const result = await uploadOnCloudinary(file.path);
                if (result) {
                    newImages.push({
                        public_id: result.public_id,
                        url: result.url
                    });
                }
            }
            req.body.images = newImages;
        }

        // Handle tryOnImage Update
        const tryOnFiles = req.files && req.files["tryOnImage"] ? req.files["tryOnImage"] : [];
        if (tryOnFiles.length > 0) {
            const tryOnFile = tryOnFiles[0];
            // Delete old tryOnImage from Cloudinary if exists
            if (product.tryOnImage && product.tryOnImage.public_id) {
                try {
                    await cloudinary.uploader.destroy(product.tryOnImage.public_id);
                } catch (err) {
                    console.error(`Failed to delete old tryOnImage ${product.tryOnImage.public_id} from Cloudinary:`, err);
                }
            }

            const result = await uploadOnCloudinary(tryOnFile.path);
            if (result) {
                req.body.tryOnImage = {
                    public_id: result.public_id,
                    url: result.url
                };
            }
        } else if (req.body.clearTryOnImage === "true") {
            if (product.tryOnImage && product.tryOnImage.public_id) {
                try {
                    await cloudinary.uploader.destroy(product.tryOnImage.public_id);
                } catch (err) {
                    console.error(`Failed to delete tryOnImage:`, err);
                }
            }
            req.body.tryOnImage = null;
        }

        const updatedProduct = await Product.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        res.status(200).json(updatedProduct);
    } catch (error) {
        console.error("❌ Update vendor product error:", error);
        res.status(500).json({ message: "Server error." });
    }
};

/**
 * @desc    Delete a vendor's product
 * @route   DELETE /api/vendor/products/:id
 * @access  Protected (vendorAuth)
 */
export const deleteVendorProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);

        if (!product) {
            return res.status(404).json({ message: "Product not found." });
        }

        // Security Check
        if (product.vendor.toString() !== req.vendor._id.toString()) {
            return res.status(403).json({ message: "Not authorized to delete this product." });
        }

        // Deleting Images from Cloudinary
        if (product.images && product.images.length > 0) {
            for (const image of product.images) {
                await cloudinary.uploader.destroy(image.public_id);
            }
        }

        await product.deleteOne();
        res.status(200).json({ message: "Product deleted successfully." });
    } catch (error) {
        console.error("❌ Delete vendor product error:", error);
        res.status(500).json({ message: "Server error." });
    }
};

/**
 * @desc    Get orders containing vendor's products
 * @route   GET /api/vendor/orders
 * @access  Protected (vendorAuth)
 */
export const getVendorOrders = async (req, res) => {
    try {
        const vendorId = req.vendor._id;

        // Find orders that contain at least one item from this vendor
        const orders = await Order.find({ "items.vendor": vendorId }).sort("-createdAt");

        // Important: Filter the items within each order to ONLY show this vendor's items
        // This prevents vendors from seeing what else the customer bought from other vendors
        const filteredOrders = orders.map(order => {
            const orderObj = order.toObject();
            orderObj.items = orderObj.items.filter(item =>
                item.vendor.toString() === vendorId.toString()
            );
            return orderObj;
        });

        res.status(200).json(filteredOrders);
    } catch (error) {
        console.error("❌ Get vendor orders error:", error);
        res.status(500).json({ message: "Server error." });
    }
};

/**
 * @desc    Update order status (from vendor perspective)
 * @route   PUT /api/vendor/orders/:id/status
 * @access  Protected (vendorAuth)
 */
export const updateVendorOrderStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const validStatuses = ["processing", "shipped", "delivered"];

        if (!validStatuses.includes(status)) {
            return res.status(400).json({ message: "Invalid status." });
        }

        const order = await Order.findById(req.params.id);

        if (!order) {
            return res.status(404).json({ message: "Order not found." });
        }

        // Check if order belongs to vendor
        const hasVendorItem = order.items.some(item =>
            item.vendor.toString() === req.vendor._id.toString()
        );

        if (!hasVendorItem) {
            return res.status(403).json({ message: "Not authorized for this order." });
        }

        order.status = status;
        await order.save();

        res.status(200).json({ message: `Order marked as ${status}.`, order });
    } catch (error) {
        console.error("❌ Update vendor order status error:", error);
        res.status(500).json({ message: "Server error." });
    }
};
