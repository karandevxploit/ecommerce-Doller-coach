const mongoose = require('mongoose');
const Product = require('./backend/models/product.model');

const payload = {
  "name": "hello ",
  "description": "jkcqowboq ejwqbfoiwboef jefoiwe",
  "category": "men",
  "subcategory": "bottomwear",
  "productType": "cotton",
  "price": 250,
  "originalPrice": 400,
  "images": [
    "https://res.cloudinary.com/dq9plk60t/image/upload/v1776829203/products/images/kebaxlfct2uh7xqgfb45.jpg",
    "https://res.cloudinary.com/dq9plk60t/image/upload/v1776829203/products/images/kebaxlfct2uh7xqgfb45.jpg",
    "https://res.cloudinary.com/dq9plk60t/image/upload/v1776829288/products/images/g2z5zrkuimocjhtmlysq.jpg",
    "https://res.cloudinary.com/dq9plk60t/image/upload/v1776829288/products/images/g2z5zrkuimocjhtmlysq.jpg"
  ],
  "primaryImage": "https://res.cloudinary.com/dq9plk60t/image/upload/v1776829203/products/images/kebaxlfct2uh7xqgfb45.jpg",
  "hoverImage": "https://res.cloudinary.com/dq9plk60t/image/upload/v1776829203/products/images/kebaxlfct2uh7xqgfb45.jpg",
  "variants": [
    {
      "sku": "HEL-MBO-BL-9217",
      "color": "black",
      "size": "28",
      "price": 250,
      "stock": 12,
      "image": "https://res.cloudinary.com/dq9plk60t/image/upload/v1776829203/products/images/kebaxlfct2uh7xqgfb45.jpg"
    },
    {
      "sku": "HEL-MBO-BL-9217",
      "color": "black",
      "size": "30",
      "price": 250,
      "stock": 12,
      "image": "https://res.cloudinary.com/dq9plk60t/image/upload/v1776829203/products/images/kebaxlfct2uh7xqgfb45.jpg"
    }
  ],
  "status": "active",
  "featured": true,
  "isTrending": true,
  "stock": 144,
  "badge": {
    "text": "new",
    "color": "#da3d16",
    "enabled": true
  },
  "offer": {
    "text": "1 free",
    "enabled": true
  },
  "controls": {
    "codAllowed": true,
    "showETA": true,
    "allowWishlist": true
  }
};

async function test() {
    try {
        const p = new Product(payload);
        const err = p.validateSync();
        if (err) {
            console.log("VALIDATION_ERROR:", JSON.stringify(err, null, 2));
        } else {
            console.log("VALIDATION_SUCCESS");
        }
    } catch (e) {
        console.log("CRASH:", e);
    }
}

test();
