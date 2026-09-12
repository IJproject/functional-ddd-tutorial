// ===========================================================================
// 型定義（仕様）
// ===========================================================================

declare const brand: unique symbol;

export type Primitive<Tag extends string, T> = T & { readonly [brand]: Tag };
export type Choice<Kind extends string, T = Record<never, never>> = T & {
	readonly kind: Kind;
};

export type NonEmptyArray<T> = readonly [T, ...T[]];

export type Result<T, E> = Ok<T> | Err<E>;
export type Ok<T> = { readonly tag: "ok"; readonly value: T };
export type Err<E> = { readonly tag: "err"; readonly error: E };

type OkValues<T extends readonly Result<unknown, unknown>[]> = {
	[K in keyof T]: T[K] extends Result<infer U, unknown> ? U : never;
};
type ErrValue<T extends readonly Result<unknown, unknown>[]> =
	T[number] extends Result<unknown, infer E> ? E : never;

// ===========================================================================
// 実装
// ===========================================================================

export const ok = <T>(value: T): Ok<T> => ({ tag: "ok", value });
export const err = <E>(error: E): Err<E> => ({ tag: "err", error });

/**
 * 成功値だけを変換する。
 * @example map(ok(1), (value) => value + 1)
 */
export const map = <T, U, E>(
	result: Result<T, E>,
	f: (value: T) => U,
): Result<U, E> => (result.tag === "ok" ? ok(f(result.value)) : result);

/**
 * 失敗値だけを変換する。
 * @example mapErr(err("invalid"), (message) => new Error(message))
 */
export const mapErr = <T, E, F>(
	result: Result<T, E>,
	f: (error: E) => F,
): Result<T, F> => (result.tag === "err" ? err(f(result.error)) : result);

/**
 * 失敗しうる処理を fail-fast で連結する。
 * @example flatMap(ok(1), (value) => ok(value + 1))
 */
export const flatMap = <T, U, E>(
	result: Result<T, E>,
	f: (value: T) => Result<U, E>,
): Result<U, E> => (result.tag === "ok" ? f(result.value) : result);

/**
 * 失敗しうる非同期処理を fail-fast で連結する。
 * @example flatMapAsync(ok(1), async (value) => ok(value + 1))
 */
export const flatMapAsync = async <T, U, E>(
	result: Result<T, E>,
	f: (value: T) => Promise<Result<U, E>>,
): Promise<Result<U, E>> => (result.tag === "ok" ? f(result.value) : result);

/**
 * I/O の連鎖は後段を実行する意味がないので、全件収集の combineAll ではなく最初のエラーで打ち切る。
 * @example combine([ok(1), ok("two")])
 */
export const combine = <const T extends readonly Result<unknown, unknown>[]>(
	results: T,
): Result<OkValues<T>, ErrValue<T>> => {
	const values: unknown[] = [];
	for (const result of results) {
		if (result.tag === "err") return err(result.error as ErrValue<T>);
		values.push(result.value);
	}
	return ok(values as OkValues<T>);
};

/**
 * フォーム検証は全件必要なので、fail-fast の combine ではなくエラーをすべて集める。
 * @example combineAll([ok(1), err("invalid")])
 */
export const combineAll = <const T extends readonly Result<unknown, unknown>[]>(
	results: T,
): Result<OkValues<T>, NonEmptyArray<ErrValue<T>>> => {
	const values: unknown[] = [];
	const errors: ErrValue<T>[] = [];
	for (const result of results) {
		if (result.tag === "err") errors.push(result.error as ErrValue<T>);
		else values.push(result.value);
	}
	if (errors.length > 0)
		return err(errors as unknown as NonEmptyArray<ErrValue<T>>);
	return ok(values as OkValues<T>);
};

/**
 * 成功と失敗を網羅して1つの値へ変換する。
 * @example match(ok(1), { ok: String, err: String })
 */
export const match = <T, E, U>(
	result: Result<T, E>,
	handlers: { ok: (value: T) => U; err: (error: E) => U },
): U =>
	result.tag === "ok" ? handlers.ok(result.value) : handlers.err(result.error);
