const axios = require('axios');

const payload = {
  "name": "hello jsiw",
  "description": "jsinb jk dsiuieb jsobeo ",
  "category": "men",
  "subcategory": "bottomwear",
  "productType": "jsahei s",
  "price": 200,
  "originalPrice": 400,
  "images": [
    "https://res.cloudinary.com/dq9plk60t/image/upload/v1776829716/products/images/drif6qutlycutvdw5dlz.jpg",
    "https://res.cloudinary.com/dq9plk60t/image/upload/v1776829716/products/images/drif6qutlycutvdw5dlz.jpg"
  ],
  "primaryImage": "https://res.cloudinary.com/dq9plk60t/image/upload/v1776829716/products/images/drif6qutlycutvdw5dlz.jpg",
  "hoverImage": "https://res.cloudinary.com/dq9plk60t/image/upload/v1776829716/products/images/drif6qutlycutvdw5dlz.jpg",
  "variants": [
    {
      "sku": "HEL-MBO-BL-9125-28-5845",
      "color": "black",
      "size": "28",
      "price": 200,
      "stock": 9,
      "image": "https://res.cloudinary.com/dq9plk60t/image/upload/v1776829716/products/images/drif6qutlycutvdw5dlz.jpg"
    }
  ],
  "status": "active",
  "featured": true,
  "isTrending": true,
  "stock": 96,
  "badge": {
    "text": "new",
    "color": "#0f172a",
    "enabled": true
  },
  "offer": {
    "text": "free",
    "enabled": true
  },
  "controls": {
    "codAllowed": true,
    "showETA": true,
    "allowWishlist": true
  }
};

axios.post('http://localhost:8001/api/admin/products', payload, {
  headers: {
    // We assume dev route ignores token since authLimiter allows or throws 401. Wait, it needs admin token. Let's just create a test route or bypass token.
  }
}).then(res => console.log("SUCCESS:", res.data))
  .catch(err => {
    console.log("ERROR RECEIVED:", err.response ? err.response.data : err.message);
  });
