export const categoryData = [
  {
    id: "women",
    label: "Women",
    children: [
      {
        id: "topwear",
        label: "Topwear",
        children: [
          { id: "tops", label: "Tops", tags: ["crop", "casual", "formal"] },
          { id: "tshirts", label: "T-Shirts" },
          { id: "shirts", label: "Shirts" },
          { id: "tunics", label: "Tunics" }
        ]
      },
      {
        id: "bottomwear",
        label: "Bottomwear",
        children: [
          { id: "jeans", label: "Jeans", tags: ["high-waist", "skinny", "wide-leg"] },
          { id: "trousers", label: "Trousers" },
          { id: "skirts", label: "Skirts" },
          { id: "shorts", label: "Shorts" }
        ]
      },
      {
        id: "ethnic",
        label: "Ethnic Wear",
        children: [
          { id: "kurtis", label: "Kurtis" },
          { id: "sarees", label: "Sarees" },
          { id: "lehenga", label: "Lehenga" },
          { id: "salwar", label: "Salwar Suits" }
        ]
      }
    ]
  },
  {
    id: "men",
    label: "Men",
    children: [
      {
        id: "topwear",
        label: "Topwear",
        children: [
          { id: "tshirts", label: "T-Shirts", tags: ["oversized", "graphic", "plain"] },
          { id: "shirts", label: "Shirts", tags: ["casual", "formal", "linen"] },
          { id: "hoodies", label: "Hoodies & Sweatshirts" }
        ]
      }
    ]
  }
];