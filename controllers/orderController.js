import Order from "../models/orderModel.js";
import User from "../models/userModel.js";
import Coupon from "../models/couponModel.js";
import Product from "../models/productModel.js";
import Vendor from "../models/vendorModel.js";

// Create new order
const createOrder = async (req, res) => {
  try {
    const { items, shippingAddress, paymentMethod, orderSummary, notes } =
      req.body;

    // Get user ID from the authenticated user
    const userId = req.user._id || req.user.id;

    // Generate unique order ID
    const orderCount = await Order.countDocuments();
    const orderId = `ORD${String(orderCount + 1).padStart(6, "0")}`;

    console.log("Generated order ID:", orderId);
    console.log("User ID:", userId);
    console.log("Request body:", req.body);

    // Validate required fields
    if (!items || !items.length) {
      return res.status(400).json({
        success: false,
        message: "Order items are required",
      });
    }

    if (!shippingAddress) {
      return res.status(400).json({
        success: false,
        message: "Shipping address is required",
      });
    }

    // Normalize shipping address to match the orderModel schema
    const normalizedShippingAddress = {
      name: shippingAddress.name,
      email: shippingAddress.email || (req.user && req.user.email),
      phone: shippingAddress.phone || shippingAddress.phoneWithCountryCode,
      addressLine1: shippingAddress.addressLine1 || shippingAddress.address,
      addressLine2: shippingAddress.addressLine2 || "",
      city: shippingAddress.city,
      state: shippingAddress.state,
      zipCode: shippingAddress.zipCode || shippingAddress.pincode,
      shippingInfo: shippingAddress.shippingInfo || {},
    };

    if (
      !normalizedShippingAddress.name ||
      !normalizedShippingAddress.email ||
      !normalizedShippingAddress.phone ||
      !normalizedShippingAddress.addressLine1 ||
      !normalizedShippingAddress.city ||
      !normalizedShippingAddress.state ||
      !normalizedShippingAddress.zipCode
    ) {
      return res.status(400).json({
        success: false,
        message: "Name, email, phone, address, city, state, and zipCode/pincode are all required in shipping address",
      });
    }

    if (!paymentMethod) {
      return res.status(400).json({
        success: false,
        message: "Payment method is required",
      });
    }

    if (!orderSummary) {
      return res.status(400).json({
        success: false,
        message: "Order summary is required",
      });
    }

    // Populate vendor ID for each item from the Product model
    const itemsWithVendor = [];
    for (const item of items) {
      const prodId = item.productId || item._id;
      if (!prodId) {
        return res.status(400).json({
          success: false,
          message: `Product ID is missing for item: ${item.name}`,
        });
      }
      const product = await Product.findById(prodId);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: `Product not found: ${item.name}`,
        });
      }

      let vendorId = product.vendor;
      if (!vendorId) {
        // Fallback to first available vendor in DB if product has no vendor assigned
        const defaultVendor = await Vendor.findOne();
        if (defaultVendor) {
          vendorId = defaultVendor._id;
        } else {
          return res.status(500).json({
            success: false,
            message: `Product "${product.name}" has no vendor, and no default vendor exists in the system.`,
          });
        }
      }

      itemsWithVendor.push({
        productId: prodId,
        name: item.name,
        price: item.price,
        originalPrice: item.originalPrice,
        quantity: item.quantity,
        size: item.size,
        color: item.color,
        category: item.category,
        image: item.image,
        vendor: vendorId,
      });
    }

    // Calculate estimated delivery (7 days from now)
    const estimatedDelivery = new Date();
    estimatedDelivery.setDate(estimatedDelivery.getDate() + 7);

    // Create order with explicit orderId and user ID
    const order = new Order({
      orderId,
      user: userId,
      items: itemsWithVendor,
      shippingAddress: normalizedShippingAddress,
      paymentMethod,
      orderSummary,
      estimatedDelivery,
      notes,
    });

    await order.save();

    // If a coupon was used, increment its usage count
    if (orderSummary.couponCode) {
      try {
        console.log(`Updating usage for coupon: ${orderSummary.couponCode}`);
        const updatedCoupon = await Coupon.findOneAndUpdate(
          {
            code: orderSummary.couponCode.toUpperCase(),
            isActive: true,
          },
          { $inc: { usedCount: 1 } },
          { new: true }
        );

        if (updatedCoupon) {
          console.log(
            `Coupon ${orderSummary.couponCode} usage updated. New count: ${updatedCoupon.usedCount}`
          );
        } else {
          console.log(
            `Coupon ${orderSummary.couponCode} not found for usage update`
          );
        }
      } catch (couponError) {
        console.error("Error updating coupon usage:", couponError);
        // Don't fail the order if coupon update fails
      }
    }

    // Populate user details for response
    await order.populate("user", "name email phone");

    res.status(201).json({
      success: true,
      message: "Order placed successfully",
      data: {
        order,
        orderId: order.orderId,
      },
    });
  } catch (error) {
    console.error("Error creating order:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create order",
      error: error.message,
    });
  }
};

// Get user orders
const getUserOrders = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const orders = await Order.find({ user: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("user", "name email phone");

    const total = await Order.countDocuments({ user: userId });

    res.status(200).json({
      success: true,
      data: {
        orders,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalOrders: total,
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching user orders:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch orders",
      error: error.message,
    });
  }
};

// Get single order details
const getOrderById = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user._id || req.user.id;

    const order = await Order.findOne({
      orderId,
      user: userId,
    }).populate("user", "name email phone");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    console.error("Error fetching order:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch order",
      error: error.message,
    });
  }
};

// Admin: Get all orders
const getAllOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const status = req.query.status;
    const search = req.query.search;

    // Build filter query
    let filter = {};
    if (status && status !== "all") {
      filter.status = status;
    }

    if (search) {
      filter.$or = [
        { orderId: { $regex: search, $options: "i" } },
        { "shippingAddress.name": { $regex: search, $options: "i" } },
        { "shippingAddress.email": { $regex: search, $options: "i" } },
      ];
    }

    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("user", "name email phone");

    const total = await Order.countDocuments(filter);

    // Get order statistics
    const stats = await Order.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalValue: { $sum: "$orderSummary.total" },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        orders,
        stats,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalOrders: total,
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch orders",
      error: error.message,
    });
  }
};

// Admin: Update order status
const updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, notes } = req.body;

    const validStatuses = [
      "pending",
      "confirmed",
      "processing",
      "shipped",
      "delivered",
      "cancelled",
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order status",
      });
    }

    const updateData = { status };
    if (notes) {
      updateData.notes = notes;
    }

    const order = await Order.findOneAndUpdate({ orderId }, updateData, {
      new: true,
    }).populate("user", "name email phone");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Order status updated successfully",
      data: order,
    });
  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update order status",
      error: error.message,
    });
  }
};

// Admin: Delete order
const deleteOrder = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findOneAndDelete({ orderId });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Order deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting order:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete order",
      error: error.message,
    });
  }
};

export {
  createOrder,
  getUserOrders,
  getOrderById,
  getAllOrders,
  updateOrderStatus,
  deleteOrder,
};
