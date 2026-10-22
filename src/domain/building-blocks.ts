export type Primitive<Tag extends string, T> = T & { readonly __brand: Tag };

export type Result<T, E> = Ok<T> | Err<E>;
export type Ok<T> = { readonly ok: true; readonly value: T };
export type Err<E> = { readonly ok: false; readonly error: E };
export type AsyncResult<T, E> = Promise<Result<T, E>>;
export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
export const err = <E>(error: E): Err<E> => ({ ok: false, error });
