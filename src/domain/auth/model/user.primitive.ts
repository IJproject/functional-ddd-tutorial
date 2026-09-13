import {
	type Case,
	err,
	ok,
	type Primitive,
	type Result,
} from "#/domain/building-blocks";

// ===========================================================================
// 型定義
// ===========================================================================

export type UserId = Primitive<"UserId", string>;
export type EmailAddress = Primitive<"EmailAddress", string>;
export type Password = Primitive<"Password", string>;

/**
 * EmailAddress の構築が失敗する理由。
 * 文言は持たない。ユーザーに見せる言葉は境界層が決める。
 */
export type EmailAddressError = Case<"Empty"> | Case<"Malformed">;

/**
 * Password の構築が失敗する理由。
 * 文言は持たない。ユーザーに見せる言葉は境界層が決める。
 */
export type PasswordError = Case<"Empty"> | Case<"TooShort">;

// ===========================================================================
// 実装
// ===========================================================================

export const UserId = {
	/**
	 * 信頼境界の内側（自前の認証基盤が発行した id）からの変換。
	 * 検証の必要がないので Result を返さない。戻り値の型が「失敗しない」ことを語る。
	 */
	create: (input: string): UserId => input as UserId,
	value: (userId: UserId): string => userId,
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const EmailAddress = {
	/**
	 * 形式検証を伴う構築子。失敗しうるので Result を返す。
	 * 失敗理由は種類だけを返し、文言も「どのフィールドか」も呼び出し側が付与する。
	 * プリミティブが表示もフォームの構造も知らないようにするため。
	 */
	create: (input: string): Result<EmailAddress, EmailAddressError> => {
		const trimmed = input.trim();
		if (trimmed === "") return err({ kind: "Empty" });
		if (!EMAIL_PATTERN.test(trimmed)) return err({ kind: "Malformed" });
		return ok(trimmed as EmailAddress);
	},
	value: (email: EmailAddress): string => email,
};

const PASSWORD_MIN_LENGTH = 8;

export const Password = {
	/**
	 * signup でも login でも同じ型を使う。
	 * 「このシステムでパスワードとして成立する文字列」は1つの概念であり、
	 * 照合の場面だけ制約を緩めると、存在しえない値を受け取ることになるため。
	 * したがってログイン時も 8 文字未満は、認証を試みる前に検証で弾く。
	 */
	create: (input: string): Result<Password, PasswordError> => {
		if (input === "") return err({ kind: "Empty" });
		if (input.length < PASSWORD_MIN_LENGTH) return err({ kind: "TooShort" });
		return ok(input as Password);
	},
	value: (password: Password): string => password,
};
