import dotenv from "dotenv";
dotenv.config();

import express from "express";
import connectDB from "./config/db.js";
import userRoutes from "./routes/userRoutes.js";
import cors from "cors";
import cookieParser from "cookie-parser";
import adminRoutes from "./routes/adminRoutes.js";
import productRoutes from "./routes/productRoutes.js"; // Import product routes
import cartRoutes from "./routes/cartRoutes.js";
import contactRoutes from "./routes/contactRoutes.js";
import shippingRoutes from "./routes/shippingRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import { errorHandler } from "./middleware/errorHandler.js";
import staffRoutes from "./routes/staffRoutes.js";
import addressRoutes from "./routes/addressRoutes.js";
import vendorRoutes from "./routes/vendorRoutes.js";

const app = express();

// Middleware
app.use(express.json());
app.use(cookieParser());

// ✅ Allow frontend requests
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002",
  "https://eyey-frontend.vercel.app",
  "https://eyey-admin-seven.vercel.app",
  "https://eyey-vendor-inky.vercel.app",
];

if (process.env.ALLOWED_ORIGINS) {
  const envOrigins = process.env.ALLOWED_ORIGINS.split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  allowedOrigins.push(...envOrigins);
}

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "Origin",
    ],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  })
);


// Connect Database
connectDB();

app.get("/", (req, res) => {
  res.send("API is running and DB connected...");
});

// Routes
app.use("/api/users", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/products", productRoutes); // Use product routes
app.use("/api/cart", cartRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/shipping", shippingRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/users/addresses", addressRoutes);
app.use("/api/vendor", vendorRoutes);

//Error handling middleware
app.use(errorHandler);

const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
