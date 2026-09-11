declare const brand: unique symbol;

export type Primitive<Tag extends string, T> = T & { readonly [brand]: Tag };
export type Variant<Kind extends string, T> = T & { readonly kind: Kind };
