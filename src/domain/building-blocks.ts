// ===========================================================================
// 型定義
// ===========================================================================

declare const brand: unique symbol;

export type Primitive<Tag extends string, T> = T & { readonly [brand]: Tag };

/**
 * choice type（case の union）を構成する case 1つ。
 * choice type そのものは union をそのまま書く（例: `type Session = AnonymousSession | AuthenticatedSession`）。
 */
export type Case<Kind extends string, T = Record<never, never>> = T & {
	readonly kind: Kind;
};

export type NonEmptyArray<T> = readonly [T, ...T[]];

export type Result<T, E> = Ok<T> | Err<E>;
export type Ok<T> = { readonly tag: "ok"; readonly value: T };
export type Err<E> = { readonly tag: "err"; readonly error: E };

/** I/O を伴うパイプラインの途中の型。`Result` との対比で I/O の有無を型で示す。 */
export type AsyncResult<T, E> = Promise<Result<T, E>>;

/** AsyncResult のコンビネータが Result / AsyncResult のどちらも受けられることを表す。 */
type Awaitable<T> = T | Promise<T>;

type OkValues<T extends readonly Result<unknown, unknown>[]> = {
	[K in keyof T]: T[K] extends Result<infer U, unknown> ? U : never;
};
type ErrValue<T extends readonly Result<unknown, unknown>[]> =
	T[number] extends Result<unknown, infer E> ? E : never;

// ===========================================================================
// 実装
// ===========================================================================

export function pipe<A, B>(a: A, ab: (a: A) => B): B;
export function pipe<A, B, C>(a: A, ab: (a: A) => B, bc: (b: B) => C): C;
export function pipe<A, B, C, D>(
	a: A,
	ab: (a: A) => B,
	bc: (b: B) => C,
	cd: (c: C) => D,
): D;
export function pipe<A, B, C, D, E>(
	a: A,
	ab: (a: A) => B,
	bc: (b: B) => C,
	cd: (c: C) => D,
	de: (d: D) => E,
): E;
export function pipe<A, B, C, D, E, F>(
	a: A,
	ab: (a: A) => B,
	bc: (b: B) => C,
	cd: (c: C) => D,
	de: (d: D) => E,
	ef: (e: E) => F,
): F;
export function pipe<A, B, C, D, E, F, G>(
	a: A,
	ab: (a: A) => B,
	bc: (b: B) => C,
	cd: (c: C) => D,
	de: (d: D) => E,
	ef: (e: E) => F,
	fg: (f: F) => G,
): G;
export function pipe<A, B, C, D, E, F, G, H>(
	a: A,
	ab: (a: A) => B,
	bc: (b: B) => C,
	cd: (c: C) => D,
	de: (d: D) => E,
	ef: (e: E) => F,
	fg: (f: F) => G,
	gh: (g: G) => H,
): H;
export function pipe<A, B, C, D, E, F, G, H, I>(
	a: A,
	ab: (a: A) => B,
	bc: (b: B) => C,
	cd: (c: C) => D,
	de: (d: D) => E,
	ef: (e: E) => F,
	fg: (f: F) => G,
	gh: (g: G) => H,
	hi: (h: H) => I,
): I;
export function pipe(
	a: unknown,
	...fns: ReadonlyArray<(x: unknown) => unknown>
): unknown {
	return fns.reduce((acc, fn) => fn(acc), a);
}

export const ok = <T>(value: T): Ok<T> => ({ tag: "ok", value });
export const err = <E>(error: E): Err<E> => ({ tag: "err", error });

/**
 * Result のコンビネータ。
 * map / mapErr / flatMap は pipe のステップとして使うため data-last、
 * 配列を畳む combine / combineAll と終端で値を潰す match は data-first とする。
 */
export const Result = {
	/**
	 * 成功値だけを変換する。
	 * @example pipe(ok(1), Result.map((value) => value + 1))
	 */
	map:
		<T, U>(f: (value: T) => U) =>
		<E>(result: Result<T, E>): Result<U, E> =>
			result.tag === "ok" ? ok(f(result.value)) : result,

	/**
	 * 失敗値だけを変換する。
	 * @example pipe(err("invalid"), Result.mapErr((message) => new Error(message)))
	 */
	mapErr:
		<E, F>(f: (error: E) => F) =>
		<T>(result: Result<T, E>): Result<T, F> =>
			result.tag === "err" ? err(f(result.error)) : result,

	/**
	 * 失敗しうる処理を fail-fast で連結する。
	 * 前段と後段でエラー型が違ってよく、結果は合流して `E | F` になる。
	 * @example pipe(ok(1), Result.flatMap((value) => ok(value + 1)))
	 */
	flatMap:
		<T, U, F>(f: (value: T) => Result<U, F>) =>
		<E>(result: Result<T, E>): Result<U, E | F> =>
			result.tag === "ok" ? f(result.value) : result,

	/**
	 * I/O の連鎖は後段を実行する意味がないので、全件収集の combineAll ではなく最初のエラーで打ち切る。
	 * @example Result.combine([ok(1), ok("two")])
	 */
	combine: <const T extends readonly Result<unknown, unknown>[]>(
		results: T,
	): Result<OkValues<T>, ErrValue<T>> => {
		const values: unknown[] = [];
		for (const result of results) {
			if (result.tag === "err") return err(result.error as ErrValue<T>);
			values.push(result.value);
		}
		return ok(values as OkValues<T>);
	},

	/**
	 * フォーム検証は全件必要なので、fail-fast の combine ではなくエラーをすべて集める。
	 * @example Result.combineAll([ok(1), err("invalid")])
	 */
	combineAll: <const T extends readonly Result<unknown, unknown>[]>(
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
	},

	/**
	 * 成功と失敗を網羅して1つの値へ変換する。
	 * @example Result.match(ok(1), { ok: String, err: String })
	 */
	match: <T, E, U>(
		result: Result<T, E>,
		handlers: { ok: (value: T) => U; err: (error: E) => U },
	): U =>
		result.tag === "ok"
			? handlers.ok(result.value)
			: handlers.err(result.error),
} as const;

export const AsyncResult = {
	/**
	 * 成功値だけを非同期パイプライン内で変換する。
	 * @example pipe(ok(1), AsyncResult.map((value) => value + 1))
	 */
	map:
		<T, U>(f: (value: T) => U) =>
		async <E>(input: Awaitable<Result<T, E>>): AsyncResult<U, E> => {
			const result = await input;
			return result.tag === "ok" ? ok(f(result.value)) : result;
		},

	/**
	 * 失敗しうる処理を非同期パイプライン内で fail-fast に連結する。
	 * 前段と後段でエラー型が違ってよく、結果は合流して `E | F` になる。
	 * @example pipe(ok(1), AsyncResult.flatMap(async (value) => ok(value + 1)))
	 */
	flatMap:
		<T, U, F>(f: (value: T) => Awaitable<Result<U, F>>) =>
		async <E>(input: Awaitable<Result<T, E>>): AsyncResult<U, E | F> => {
			const result = await input;
			return result.tag === "ok" ? f(result.value) : result;
		},
} as const;

/**
 * choice type（case の union）を網羅的に分岐する。
 * ハンドラが1つでも欠けるとコンパイルエラーになるので、case を追加したときに
 * 分岐の漏れが型で分かる。三項演算子や非網羅的な switch はこれに置き換える。
 * @example matchChoice(session, { AnonymousSession: () => null, AuthenticatedSession: (s) => s.userId })
 */
export const matchChoice = <C extends { kind: string }, U>(
	choice: C,
	handlers: { [K in C["kind"]]: (c: Extract<C, { kind: K }>) => U },
): U => (handlers[choice.kind as C["kind"]] as (c: C) => U)(choice);
