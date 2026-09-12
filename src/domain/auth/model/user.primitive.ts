import { err, ok, type Primitive, type Result } from "#/domain/building-blocks";

// ===========================================================================
// 型定義（仕様）
// ===========================================================================

export type UserId = Primitive<"UserId", string>;
export type EmailAddress = Primitive<"EmailAddress", string>;

// ===========================================================================
// 実装
// ===========================================================================

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * 形式検証を伴う構築子。失敗しうるので Result を返す。
 * 誤りの内容はメッセージのみを返し、「どのフィールドか」は呼び出し側（検証関数）が付与する。
 * プリミティブがフォームの構造を知らないようにするため。
 */
export const createEmailAddress = (
	input: string,
): Result<EmailAddress, string> => {
	const trimmed = input.trim();
	if (trimmed === "") return err("メールアドレスを入力してください");
	if (!EMAIL_PATTERN.test(trimmed))
		return err("メールアドレスの形式が正しくありません");
	return ok(trimmed as EmailAddress);
};

/**
 * 信頼境界の内側（自前の認証基盤が発行した id）からの変換。
 * 検証の必要がないので Result を返さない。
 */
export const toUserId = (value: string): UserId => value as UserId;
