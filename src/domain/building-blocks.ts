declare const brand: unique symbol;

export type Primitive<Tag extends string, T> = T & { readonly [brand]: Tag };
export type Choice<Kind extends string, T> = T & { readonly kind: Kind };

export type Result<T, E> = Ok<T> | Err<E>;
export type Ok<T> = Choice<"Ok", { value: T }>;
export type Err<E> = Choice<"Err", { error: E }>;
