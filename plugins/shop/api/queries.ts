/**
 * GraphQL Storefront documents used by the shop plugin.
 * Field sets are verified against graphql-storefront b-7.4.x;
 * generated types (codegen) replace these hand-written shapes in a later core story.
 */

export interface ProductPrice {
  price: number;
  currency: { name: string; sign: string };
}

export interface ProductListItem {
  id: string;
  title: string;
  shortDescription: string;
  price: ProductPrice;
  imageGallery: { thumb: string };
}

export interface ProductDetail extends ProductListItem {
  longDescription: string;
  imageGallery: { thumb: string; images: Array<{ image: string }> };
}

export const PRODUCTS_QUERY = /* GraphQL */ `
  query products($offset: Int!, $limit: Int!) {
    products(pagination: { offset: $offset, limit: $limit }) {
      id
      title
      shortDescription
      price {
        price
        currency {
          name
          sign
        }
      }
      imageGallery {
        thumb
      }
    }
  }
`;

export const PRODUCT_QUERY = /* GraphQL */ `
  query product($id: ID!) {
    product(productId: $id) {
      id
      title
      shortDescription
      longDescription
      price {
        price
        currency {
          name
          sign
        }
      }
      imageGallery {
        thumb
        images {
          image
        }
      }
    }
  }
`;

export interface CategoryItem {
  id: string;
  title: string;
}

export const CATEGORIES_QUERY = /* GraphQL */ `
  query categories {
    categories {
      id
      title
    }
  }
`;

export const CATEGORY_QUERY = /* GraphQL */ `
  query category($id: ID!) {
    category(categoryId: $id) {
      id
      title
    }
  }
`;

export const CATEGORY_PRODUCTS_QUERY = /* GraphQL */ `
  query categoryProducts($categoryId: ID!, $offset: Int!, $limit: Int!) {
    products(
      filter: { category: { equals: $categoryId } }
      pagination: { offset: $offset, limit: $limit }
    ) {
      id
      title
      shortDescription
      price {
        price
        currency {
          name
          sign
        }
      }
      imageGallery {
        thumb
      }
    }
  }
`;
