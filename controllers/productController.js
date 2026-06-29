import Product from "../models/productModel.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { promises as fs } from "fs";
import { v2 as cloudinary } from "cloudinary";
import mongoose from "mongoose";
import csv from "csv-parser";
import { createReadStream } from "fs";

// Create Product -- Admin
export const createProduct = async (req, res, next) => {
  try {
    const {
      name,
      description,
      price,
      category,
      stock,
      brand,
      sellerName,
      sellerRating,
      deliveryTimeline,
      frameDimensions,
      productInformation,
      newArrival,
      hotSeller,
      men,
      women,
      kids,
    } = req.body;

    const imageFiles = req.files && req.files["images"] ? req.files["images"] : [];
    if (imageFiles.length === 0) {
      return res.status(400).json({ message: "No product images uploaded" });
    }

    const images = [];

    for (const file of imageFiles) {
      const cloudinaryResponse = await uploadOnCloudinary(file.path);
      if (cloudinaryResponse) {
        images.push({
          public_id: cloudinaryResponse.public_id,
          url: cloudinaryResponse.url,
        });
      } else {
        console.error(
          `Failed to upload file ${file.originalname} to Cloudinary`
        );
      }
    }

    req.body.images = images;

    // Handle optional Try-On Frame image upload
    const tryOnFiles = req.files && req.files["tryOnImage"] ? req.files["tryOnImage"] : [];
    if (tryOnFiles.length > 0) {
      const tryOnFile = tryOnFiles[0];
      const cloudinaryResponse = await uploadOnCloudinary(tryOnFile.path);
      if (cloudinaryResponse) {
        req.body.tryOnImage = {
          public_id: cloudinaryResponse.public_id,
          url: cloudinaryResponse.url,
        };
      } else {
        console.error(
          `Failed to upload tryOnImage file ${tryOnFile.originalname} to Cloudinary`
        );
      }
    }
    // Only assign req.body.user if req.admin.id is a valid ObjectId
    if (req.admin.id && mongoose.Types.ObjectId.isValid(req.admin.id)) {
      req.body.user = req.admin.id;
    } else {
      console.warn(
        "Admin ID is not a valid ObjectId, product will be created without a user reference."
      );
      delete req.body.user; // Ensure the invalid user field is not passed to Mongoose
    }

    const product = await Product.create(req.body);

    // Remove temporary image files after successful upload and product creation
    // This block is removed as cleanup is handled by uploadOnCloudinary.
    // for (const file of req.files) {
    //   await fs.unlink(file.path);
    // }

    res.status(201).json({
      success: true,
      product,
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => err.message);
      console.error("Product Validation Error:", errors);
      return res.status(400).json({ message: "Validation Error", errors });
    } else {
      console.error("Error creating product:", error);
      return res.status(500).json({ message: "Server Error" });
    }
  }
};

// Get All Product
export const getProducts = async (req, res, next) => {
  try {
    const query = {};

    // Filter by category if provided in query params
    if (req.query.category) {
      query.category = req.query.category;
    }

    // Filter by search query if provided in query params
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, "i");
      query.$or = [
        { name: { $regex: searchRegex } },
        { description: { $regex: searchRegex } },
        { brand: { $regex: searchRegex } },
        { category: { $regex: searchRegex } },
      ];
    }

    // Filter by hotSeller if provided in query params
    if (req.query.hotSeller) {
      // Convert string "true"/"false" to boolean
      query.hotSeller = req.query.hotSeller === "true";
    }

    // Filter by newArrival if provided in query params
    if (req.query.newArrival) {
      // Convert string "true"/"false" to boolean
      query.newArrival = req.query.newArrival === "true";
    }

    // Filter by men if provided in query params
    if (req.query.men) {
      // Convert string "true"/"false" to boolean
      query.men = req.query.men === "true";
    }

    // Filter by women if provided in query params
    if (req.query.women) {
      // Convert string "true"/"false" to boolean
      query.women = req.query.women === "true";
    }

    // Filter by kids if provided in query params
    if (req.query.kids) {
      // Convert string "true"/"false" to boolean
      query.kids = req.query.kids === "true";
    }

    let queryBuilder = Product.find(query);

    if (req.query.limit) {
      const limitVal = parseInt(req.query.limit, 10);
      if (!isNaN(limitVal)) {
        queryBuilder = queryBuilder.limit(limitVal);
      }
    }

    const products = await queryBuilder;

    res.status(200).json({
      success: true,
      products,
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// Get Product Details
export const getProductById = async (req, res, next) => {
  try {
    const productIdOrSlug = req.params.id;

    let product;

    if (mongoose.Types.ObjectId.isValid(productIdOrSlug)) {
      // If it's a valid ObjectId, try to find by ID
      product = await Product.findById(productIdOrSlug);
    }

    if (!product) {
      // If not found by ID or not an ObjectId, try to find by slugified name (case-insensitive)
      const slugRegex = new RegExp(productIdOrSlug.replace(/-/g, " "), "i");
      product = await Product.findOne({ name: { $regex: slugRegex } });
    }

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.status(200).json({
      success: true,
      product,
    });
  } catch (error) {
    console.error("Error fetching product details:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// Update Product -- Admin
export const updateProduct = async (req, res, next) => {
  try {
    console.log("📦 Update Product Request:");
    console.log("Product ID:", req.params.id);
    console.log("Request Body:", JSON.stringify(req.body, null, 2));

    let product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    console.log("📦 Current product stock:", product.stock);

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
        const cloudinaryResponse = await uploadOnCloudinary(file.path);
        if (cloudinaryResponse) {
          newImages.push({
            public_id: cloudinaryResponse.public_id,
            url: cloudinaryResponse.url,
          });
        }
      }
      req.body.images = newImages;
    }

    // Handle VTO Image Update
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

      const cloudinaryResponse = await uploadOnCloudinary(tryOnFile.path);
      if (cloudinaryResponse) {
        req.body.tryOnImage = {
          public_id: cloudinaryResponse.public_id,
          url: cloudinaryResponse.url,
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

    product = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
      useFindAndModify: false,
    });

    console.log("📦 Updated product stock:", product.stock);
    console.log("✅ Product updated successfully in database");

    res.status(200).json({
      success: true,
      product,
    });
  } catch (error) {
    console.error("Error updating product:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// Delete Product -- Admin
export const deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Deleting Images from Cloudinary
    for (const image of product.images) {
      await cloudinary.uploader.destroy(image.public_id);
    }

    await product.deleteOne();

    res.status(200).json({
      success: true,
      message: "Product Delete Successfully",
    });
  } catch (error) {
    console.error("Error deleting product:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// Bulk Upload Products from CSV -- Admin
export const bulkUploadProducts = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No CSV file uploaded" });
    }

    console.log("Uploaded file info:", {
      filename: req.file.filename,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: req.file.path,
    });

    // Read file content for debugging
    const fileContent = await fs.readFile(req.file.path, "utf8");
    console.log("File content preview:", fileContent.substring(0, 500));

    const products = [];
    const errors = [];
    let rowIndex = 0;

    // Create a Promise to handle the CSV parsing
    const processCSV = () => {
      return new Promise((resolve, reject) => {
        createReadStream(req.file.path)
          .pipe(
            csv({
              skipEmptyLines: true,
              trim: true,
              skipLinesWithError: true,
            })
          )
          .on("data", (row) => {
            rowIndex++;

            // Skip completely empty rows
            const hasData = Object.values(row).some(
              (value) =>
                value && typeof value === "string" && value.trim() !== ""
            );

            if (!hasData) {
              console.log(`Skipping empty row ${rowIndex}`);
              return;
            }

            console.log(
              `Processing row ${rowIndex}:`,
              JSON.stringify(row, null, 2)
            );
            console.log(`Row keys:`, Object.keys(row));

            try {
              // Validate required fields with more robust checking
              const requiredFields = [
                "name",
                "price",
                "category",
                "stock",
                "brand",
                "description",
                "sellerName",
                "sellerRating",
                "deliveryTimeline",
              ];

              // Clean and normalize field names from CSV
              const cleanRow = {};
              for (const [key, value] of Object.entries(row)) {
                const cleanKey = key.trim().toLowerCase();
                cleanRow[cleanKey] =
                  typeof value === "string" ? value.trim() : value;
              }

              console.log(`Row ${rowIndex} clean data:`, cleanRow);

              const missingFields = requiredFields.filter((field) => {
                const value = cleanRow[field.toLowerCase()];
                return !value || (typeof value === "string" && value === "");
              });

              if (missingFields.length > 0) {
                console.log(`Row ${rowIndex} missing fields:`, missingFields);
                console.log(`Row ${rowIndex} data:`, row);
                errors.push({
                  row: rowIndex,
                  message: `Missing required fields: ${missingFields.join(
                    ", "
                  )}`,
                });
                return;
              }

              // Parse and validate data types
              const price = parseFloat(cleanRow.price);
              const stock = parseInt(cleanRow.stock);

              if (isNaN(price) || price <= 0) {
                errors.push({
                  row: rowIndex,
                  message: "Invalid price value",
                });
                return;
              }

              if (isNaN(stock) || stock < 0) {
                errors.push({
                  row: rowIndex,
                  message: "Invalid stock value",
                });
                return;
              }

              // Parse boolean fields
              const parseBoolean = (value) => {
                if (typeof value === "string") {
                  return value.toLowerCase() === "true" || value === "1";
                }
                return Boolean(value);
              };

              // Parse images from pipe-separated URLs (changed from comma to avoid CSV conflicts)
              let images = [];
              if (cleanRow.images && cleanRow.images.trim()) {
                const imageUrls = cleanRow.images
                  .split("|")
                  .map((url) => url.trim())
                  .filter((url) => url);
                images = imageUrls.map((url) => ({
                  public_id: `bulk_upload_${Date.now()}_${Math.random()}`,
                  url: url,
                }));
              }

              // Create product object
              const productData = {
                name: cleanRow.name,
                description: cleanRow.description,
                price: price,
                category: cleanRow.category,
                stock: stock,
                brand: cleanRow.brand,
                sellerName: cleanRow.sellername || "",
                sellerRating: parseFloat(cleanRow.sellerrating) || 0,
                deliveryTimeline: cleanRow.deliverytimeline || "",
                frameDimensions: cleanRow.framedimensions || "",
                productInformation: cleanRow.productinformation || "",
                newArrival: parseBoolean(cleanRow.newarrival),
                hotSeller: parseBoolean(cleanRow.hotseller),
                men: parseBoolean(cleanRow.men),
                women: parseBoolean(cleanRow.women),
                kids: parseBoolean(cleanRow.kids),
                images: images,
              };

              // Add admin ID if available
              if (
                req.admin.id &&
                mongoose.Types.ObjectId.isValid(req.admin.id)
              ) {
                productData.user = req.admin.id;
              }

              products.push(productData);
            } catch (error) {
              errors.push({
                row: rowIndex,
                message: `Error processing row: ${error.message}`,
              });
            }
          })
          .on("end", () => {
            console.log(
              `CSV parsing completed. Total rows: ${rowIndex}, Products: ${products.length}, Errors: ${errors.length}`
            );
            resolve();
          })
          .on("error", (error) => {
            console.error("CSV parsing error:", error);
            reject(error);
          });
      });
    };

    // Process the CSV file
    await processCSV();

    // Clean up uploaded CSV file
    try {
      await fs.unlink(req.file.path);
    } catch (unlinkError) {
      console.warn("Could not delete temporary file:", unlinkError.message);
    }

    // Check if there are validation errors
    if (errors.length > 0 && products.length === 0) {
      return res.status(400).json({
        success: false,
        message: "CSV processing completed with errors",
        errors: errors,
        processedProducts: 0,
      });
    }

    if (products.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid products found in CSV file",
      });
    }

    // Bulk insert products
    try {
      const createdProducts = await Product.insertMany(products, {
        ordered: false,
      });

      res.status(201).json({
        success: true,
        message: `Successfully created ${createdProducts.length} products`,
        products: createdProducts,
        totalProcessed: rowIndex,
        errors: errors,
      });
    } catch (dbError) {
      console.error("Database error during bulk insert:", dbError);

      // Handle duplicate key errors and other validation errors
      if (dbError.writeErrors) {
        const bulkErrors = dbError.writeErrors.map((error) => ({
          message: error.errmsg,
          productData: error.getOperation && error.getOperation(),
        }));

        return res.status(400).json({
          success: false,
          message: "Some products could not be created",
          errors: bulkErrors,
          createdCount: dbError.result ? dbError.result.insertedCount : 0,
        });
      }

      res.status(500).json({
        success: false,
        message: "Database error during bulk upload",
        error: dbError.message,
      });
    }
  } catch (error) {
    console.error("Error in bulk upload:", error);
    res.status(500).json({
      success: false,
      message: "Server error during bulk upload",
      error: error.message,
    });
  }
};

// Download CSV Template -- Admin
export const downloadCSVTemplate = async (req, res, next) => {
  try {
    // Define CSV headers matching the product schema
    const headers = [
      "name",
      "price",
      "category",
      "stock",
      "brand",
      "description",
      "sellerName",
      "sellerRating",
      "deliveryTimeline",
      "frameDimensions",
      "productInformation",
      "newArrival",
      "hotSeller",
      "men",
      "women",
      "kids",
      "images",
    ];

    // Helper function to properly escape CSV fields
    const escapeCSVField = (field) => {
      if (field === null || field === undefined) return "";
      const str = String(field);
      // If field contains comma, quote, or newline, wrap in quotes and escape internal quotes
      if (
        str.includes(",") ||
        str.includes('"') ||
        str.includes("\n") ||
        str.includes("\r")
      ) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    // Create sample data row to show expected format
    const sampleData = [
      "Ray-Ban Aviator Sunglasses",
      "150.99",
      "Sunglasses",
      "25",
      "Ray-Ban",
      "Classic aviator sunglasses with premium UV protection and durable metal frame",
      "Lenskart",
      "4.5",
      "Delivered within 3-5 working days",
      "58-14-140 mm",
      "Material: Metal frame Glass lenses. Features: UV400 protection Anti-reflective coating",
      "true",
      "false",
      "true",
      "false",
      "false",
      "https://example.com/image1.jpg|https://example.com/image2.jpg",
    ];

    // Create CSV content with proper escaping
    const csvLines = [];
    csvLines.push(headers.map(escapeCSVField).join(","));
    csvLines.push(sampleData.map(escapeCSVField).join(","));
    // Remove the empty row - users can add their own rows

    const csvContent = csvLines.join("\n");

    // Set response headers for file download
    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="product_upload_template.csv"'
    );

    res.status(200).send(csvContent);
  } catch (error) {
    console.error("Error generating CSV template:", error);
    res.status(500).json({
      success: false,
      message: "Error generating CSV template",
      error: error.message,
    });
  }
};

// Bulk Upload Images to Cloudinary -- Admin
export const bulkUploadImages = async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No images uploaded",
      });
    }

    if (req.files.length > 50) {
      return res.status(400).json({
        success: false,
        message: "Cannot upload more than 50 images at once",
      });
    }

    console.log(`Starting bulk image upload for ${req.files.length} images`);

    const uploadedImages = [];
    const errors = [];

    // Process images in batches to avoid overwhelming Cloudinary
    const batchSize = 10;
    const batches = [];

    for (let i = 0; i < req.files.length; i += batchSize) {
      batches.push(req.files.slice(i, i + batchSize));
    }

    let processedCount = 0;

    for (const batch of batches) {
      const batchPromises = batch.map(async (file, index) => {
        try {
          console.log(
            `Uploading image ${processedCount + index + 1}/${req.files.length
            }: ${file.originalname}`
          );

          const cloudinaryResponse = await uploadOnCloudinary(file.path);

          if (cloudinaryResponse) {
            return {
              success: true,
              originalName: file.originalname,
              cloudinary: {
                public_id: cloudinaryResponse.public_id,
                url: cloudinaryResponse.url,
                secure_url: cloudinaryResponse.secure_url,
                width: cloudinaryResponse.width,
                height: cloudinaryResponse.height,
                format: cloudinaryResponse.format,
                bytes: cloudinaryResponse.bytes,
              },
            };
          } else {
            throw new Error("Failed to upload to Cloudinary");
          }
        } catch (error) {
          console.error(
            `Failed to upload ${file.originalname}:`,
            error.message
          );
          return {
            success: false,
            originalName: file.originalname,
            error: error.message,
          };
        }
      });

      // Wait for current batch to complete
      const batchResults = await Promise.all(batchPromises);

      // Separate successful uploads from errors
      batchResults.forEach((result) => {
        if (result.success) {
          uploadedImages.push(result);
        } else {
          errors.push(result);
        }
      });

      processedCount += batch.length;
      console.log(
        `Completed batch: ${processedCount}/${req.files.length} images processed`
      );
    }

    // Clean up temporary files
    const cleanupPromises = req.files.map((file) =>
      fs
        .unlink(file.path)
        .catch((err) =>
          console.warn(
            `Could not delete temporary file ${file.path}:`,
            err.message
          )
        )
    );
    await Promise.all(cleanupPromises);

    console.log(
      `Bulk image upload completed: ${uploadedImages.length} successful, ${errors.length} failed`
    );

    // Send response
    res.status(200).json({
      success: true,
      message: `Successfully uploaded ${uploadedImages.length} images`,
      totalProcessed: req.files.length,
      uploadedImages: uploadedImages,
      errors: errors,
      summary: {
        successful: uploadedImages.length,
        failed: errors.length,
        total: req.files.length,
      },
    });
  } catch (error) {
    console.error("Error in bulk image upload:", error);

    // Clean up temporary files in case of error
    if (req.files) {
      const cleanupPromises = req.files.map((file) =>
        fs
          .unlink(file.path)
          .catch((err) => console.warn(`Cleanup error:`, err.message))
      );
      await Promise.all(cleanupPromises);
    }

    res.status(500).json({
      success: false,
      message: "Server error during bulk image upload",
      error: error.message,
    });
  }
};
