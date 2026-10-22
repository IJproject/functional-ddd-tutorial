import { describe, expect, it } from "vitest";
import {
	Amount,
	EmailAddress,
	InvoiceId,
	IssuedAt,
	login,
	Password,
	type RegisterUserPort,
	signup,
	UserId,
	UserName,
	type VerifyCredentialsPort,
	validateCredentials,
	validateRegistration,
} from "./primitive";

/** @see {@link InvoiceId.create} */
describe("InvoiceId.create", () => {
	const TEST_CASES = [
		{
			title: "形式とチェックディジットが正しい ID を受け付ける",
			args: { input: "INV-12345678-6" },
			expected: { ok: true, value: "INV-12345678-6" },
		},
		{
			title: "数字の和が 0 のとき、チェックディジット 0 を受け付ける",
			args: { input: "INV-00000000-0" },
			expected: { ok: true, value: "INV-00000000-0" },
		},
		{
			title:
				"数字の和が2桁のとき、その下1桁をチェックディジットとして受け付ける",
			args: { input: "INV-99999999-2" },
			expected: { ok: true, value: "INV-99999999-2" },
		},
		{
			title: "チェックディジットが数字の和の下1桁と違うときは不一致になる",
			args: { input: "INV-12345678-2" },
			expected: { ok: false, error: "InvoiceIdCheckDigitMismatch" },
		},
		{
			title:
				"数字の和が 0 なのにチェックディジットが 0 でないときは不一致になる",
			args: { input: "INV-00000000-1" },
			expected: { ok: false, error: "InvoiceIdCheckDigitMismatch" },
		},
		{
			title: "INV- で始まらない文字列は形式違いになる",
			args: { input: "abc" },
			expected: { ok: false, error: "InvoiceIdMalformed" },
		},
		{
			title: "空文字は形式違いになる",
			args: { input: "" },
			expected: { ok: false, error: "InvoiceIdMalformed" },
		},
		{
			title: "接頭辞が小文字のときは形式違いになる",
			args: { input: "inv-12345678-6" },
			expected: { ok: false, error: "InvoiceIdMalformed" },
		},
		{
			title: "数字が7桁のときは形式違いになる",
			args: { input: "INV-1234567-6" },
			expected: { ok: false, error: "InvoiceIdMalformed" },
		},
		{
			title: "数字が9桁のときは形式違いになる",
			args: { input: "INV-123456789-6" },
			expected: { ok: false, error: "InvoiceIdMalformed" },
		},
		{
			title: "数字の部分に数字以外が含まれるときは形式違いになる",
			args: { input: "INV-1234567a-6" },
			expected: { ok: false, error: "InvoiceIdMalformed" },
		},
		{
			title: "チェックディジットが2桁のときは形式違いになる",
			args: { input: "INV-12345678-66" },
			expected: { ok: false, error: "InvoiceIdMalformed" },
		},
	];

	it.each(TEST_CASES)("$title", ({ args, expected }) => {
		expect(InvoiceId.create(args.input)).toEqual(expected);
	});
});

/** @see {@link Amount.create} */
describe("Amount.create", () => {
	const TEST_CASES = [
		{
			title: "正の整数を受け付ける",
			args: { input: 1980 },
			expected: { ok: true, value: 1980 },
		},
		{
			title: "0 を受け付ける",
			args: { input: 0 },
			expected: { ok: true, value: 0 },
		},
		{
			title: "負の数は受け付けない",
			args: { input: -1 },
			expected: { ok: false, error: "AmountNegative" },
		},
		{
			title: "小数は受け付けない",
			args: { input: 1.5 },
			expected: { ok: false, error: "AmountNotInteger" },
		},
		{
			title: "NaN は受け付けない",
			args: { input: Number.NaN },
			expected: { ok: false, error: "AmountNotInteger" },
		},
		{
			title: "Infinity は受け付けない",
			args: { input: Number.POSITIVE_INFINITY },
			expected: { ok: false, error: "AmountNotInteger" },
		},
	];

	it.each(TEST_CASES)("$title", ({ args, expected }) => {
		expect(Amount.create(args.input)).toEqual(expected);
	});
});

/** @see {@link IssuedAt.create} */
describe("IssuedAt.create", () => {
	const TEST_CASES = [
		{
			title: "時差付きの ISO 8601 を受け付ける",
			args: { input: "2026-10-11T13:00:00+09:00" },
			expected: { ok: true, value: new Date("2026-10-11T04:00:00Z") },
		},
		{
			title: "UTC の ISO 8601 を受け付ける",
			args: { input: "2026-10-11T04:00:00Z" },
			expected: { ok: true, value: new Date("2026-10-11T04:00:00Z") },
		},
		{
			title: "日付として読めない文字列は受け付けない",
			args: { input: "abc" },
			expected: { ok: false, error: "IssuedAtInvalid" },
		},
		{
			title: "空文字は受け付けない",
			args: { input: "" },
			expected: { ok: false, error: "IssuedAtInvalid" },
		},
		{
			title: "存在しない月は受け付けない",
			args: { input: "2026-13-01T00:00:00Z" },
			expected: { ok: false, error: "IssuedAtInvalid" },
		},
	];

	it.each(TEST_CASES)("$title", ({ args, expected }) => {
		expect(IssuedAt.create(args.input)).toEqual(expected);
	});
});

/** @see {@link EmailAddress.create} */
describe("EmailAddress.create", () => {
	const TEST_CASES = [
		{
			title: "メールアドレスを受け付ける",
			args: { input: "a@b.co" },
			expected: { ok: true, value: "a@b.co" },
		},
		{
			title: "前後の空白を取り除いて受け付ける",
			args: { input: "  a@b.co  " },
			expected: { ok: true, value: "a@b.co" },
		},
		{
			title: "@ が無ければ形式違いになる",
			args: { input: "ab.co" },
			expected: { ok: false, error: "EmailAddressMalformed" },
		},
		{
			title: "@ の後ろに . が無ければ形式違いになる",
			args: { input: "a@b" },
			expected: { ok: false, error: "EmailAddressMalformed" },
		},
		{
			title: "空文字は受け付けない",
			args: { input: "" },
			expected: { ok: false, error: "EmailAddressEmpty" },
		},
		{
			title: "空白だけの文字列は空として扱う",
			args: { input: "   " },
			expected: { ok: false, error: "EmailAddressEmpty" },
		},
	];

	it.each(TEST_CASES)("$title", ({ args, expected }) => {
		expect(EmailAddress.create(args.input)).toEqual(expected);
	});
});

/** @see {@link Password.create} */
describe("Password.create", () => {
	const TEST_CASES = [
		{
			title: "8文字のパスワードを受け付ける",
			args: { input: "12345678" },
			expected: { ok: true, value: "12345678" },
		},
		{
			title: "7文字のパスワードは短すぎる",
			args: { input: "1234567" },
			expected: { ok: false, error: "PasswordTooShort" },
		},
		{
			title: "空文字は受け付けない",
			args: { input: "" },
			expected: { ok: false, error: "PasswordEmpty" },
		},
		{
			title: "前後の空白も、パスワードの文字として数える",
			args: { input: " 123456 " },
			expected: { ok: true, value: " 123456 " },
		},
	];

	it.each(TEST_CASES)("$title", ({ args, expected }) => {
		expect(Password.create(args.input)).toEqual(expected);
	});
});

/** @see {@link UserId.create} */
describe("UserId.create", () => {
	const TEST_CASES = [
		{
			title: "1 を受け付ける",
			args: { input: 1 },
			expected: { ok: true, value: 1 },
		},
		{
			title: "0 は受け付けない",
			args: { input: 0 },
			expected: { ok: false, error: "UserIdNotPositive" },
		},
		{
			title: "負の数は受け付けない",
			args: { input: -1 },
			expected: { ok: false, error: "UserIdNotPositive" },
		},
		{
			title: "小数は受け付けない",
			args: { input: 1.5 },
			expected: { ok: false, error: "UserIdNotInteger" },
		},
		{
			title: "NaN は受け付けない",
			args: { input: Number.NaN },
			expected: { ok: false, error: "UserIdNotInteger" },
		},
	];

	it.each(TEST_CASES)("$title", ({ args, expected }) => {
		expect(UserId.create(args.input)).toEqual(expected);
	});
});

/** @see {@link UserName.create} */
describe("UserName.create", () => {
	const TEST_CASES = [
		{
			title: "名前を受け付ける",
			args: { input: "太郎" },
			expected: { ok: true, value: "太郎" },
		},
		{
			title: "前後の空白を取り除いて受け付ける",
			args: { input: " 太郎 " },
			expected: { ok: true, value: "太郎" },
		},
		{
			title: "空文字は受け付けない",
			args: { input: "" },
			expected: { ok: false, error: "UserNameEmpty" },
		},
		{
			title: "空白だけの文字列は空として扱う",
			args: { input: "   " },
			expected: { ok: false, error: "UserNameEmpty" },
		},
	];

	it.each(TEST_CASES)("$title", ({ args, expected }) => {
		expect(UserName.create(args.input)).toEqual(expected);
	});
});

/** @see {@link validateCredentials} */
describe("validateCredentials", () => {
	const TEST_CASES = [
		{
			title: "メールアドレスとパスワードが正しければ、検証済みの資格情報を返す",
			args: { credentials: { email: "a@b.co", password: "12345678" } },
			expected: { ok: true, value: { email: "a@b.co", password: "12345678" } },
		},
		{
			title: "両方とも正しくなければ、両方のエラーを返す",
			args: { credentials: { email: "ab", password: "123" } },
			expected: {
				ok: false,
				error: ["EmailAddressMalformed", "PasswordTooShort"],
			},
		},
		{
			title: "メールアドレスだけが正しくなければ、そのエラーだけを返す",
			args: { credentials: { email: "", password: "12345678" } },
			expected: { ok: false, error: ["EmailAddressEmpty"] },
		},
		{
			title: "パスワードだけが正しくなければ、そのエラーだけを返す",
			args: { credentials: { email: "a@b.co", password: "" } },
			expected: { ok: false, error: ["PasswordEmpty"] },
		},
	];

	it.each(TEST_CASES)("$title", ({ args, expected }) => {
		expect(validateCredentials(args.credentials)).toEqual(expected);
	});
});

/** @see {@link validateRegistration} */
describe("validateRegistration", () => {
	const TEST_CASES = [
		{
			title: "名前と資格情報が正しければ、検証済みの登録の内容を返す",
			args: {
				registration: { name: " 太郎 ", email: "a@b.co", password: "12345678" },
			},
			expected: {
				ok: true,
				value: { name: "太郎", email: "a@b.co", password: "12345678" },
			},
		},
		{
			title: "すべて正しくなければ、すべてのエラーを返す",
			args: { registration: { name: "", email: "ab", password: "123" } },
			expected: {
				ok: false,
				error: ["UserNameEmpty", "EmailAddressMalformed", "PasswordTooShort"],
			},
		},
		{
			title: "名前だけが正しくなければ、そのエラーだけを返す",
			args: {
				registration: { name: "", email: "a@b.co", password: "12345678" },
			},
			expected: { ok: false, error: ["UserNameEmpty"] },
		},
		{
			title: "資格情報だけが正しくなければ、そのエラーだけを返す",
			args: { registration: { name: "太郎", email: "", password: "12345678" } },
			expected: { ok: false, error: ["EmailAddressEmpty"] },
		},
	];

	it.each(TEST_CASES)("$title", ({ args, expected }) => {
		expect(validateRegistration(args.registration)).toEqual(expected);
	});
});

const USER_ID = 1 as UserId;

// verifyCredentialsAdapter の代わりに差し込む偽物。認証基盤の答え方ごとに1つずつ用意する
const verifyCredentialsStubAdapter = {
	matched: async () => ({ ok: true, value: USER_ID }),
	unmatched: async () => ({ ok: true, value: null }),
	unavailable: async () => ({ ok: false, error: "AuthProviderUnavailable" }),
} satisfies Record<string, VerifyCredentialsPort>;

/** @see {@link login} */
describe("login", () => {
	const CREDENTIALS = { email: "a@b.co", password: "12345678" };
	const TEST_CASES = [
		{
			title: "照合が合えば、ログインできたというイベントを返す",
			args: {
				verifyCredentials: verifyCredentialsStubAdapter.matched,
				credentials: CREDENTIALS,
			},
			expected: { ok: true, value: { userId: USER_ID } },
		},
		{
			title: "照合が合わなければ AuthenticationFailed になる",
			args: {
				verifyCredentials: verifyCredentialsStubAdapter.unmatched,
				credentials: CREDENTIALS,
			},
			expected: { ok: false, error: ["AuthenticationFailed"] },
		},
		{
			title: "認証基盤が答えられなければ AuthProviderUnavailable になる",
			args: {
				verifyCredentials: verifyCredentialsStubAdapter.unavailable,
				credentials: CREDENTIALS,
			},
			expected: { ok: false, error: ["AuthProviderUnavailable"] },
		},
		{
			title: "入力が正しくなければ、照合せずに検証のエラーを返す",
			args: {
				verifyCredentials: verifyCredentialsStubAdapter.matched,
				credentials: { email: "ab", password: "123" },
			},
			expected: {
				ok: false,
				error: ["EmailAddressMalformed", "PasswordTooShort"],
			},
		},
	];

	it.each(TEST_CASES)("$title", async ({ args, expected }) => {
		const result = await login({ verifyCredentials: args.verifyCredentials })({
			credentials: args.credentials,
		});
		expect(result).toEqual(expected);
	});
});

// registerUserAdapter の代わりに差し込む偽物。認証基盤の答え方ごとに1つずつ用意する
const registerUserStubAdapter = {
	created: async () => ({ ok: true, value: USER_ID }),
	emailTaken: async () => ({ ok: true, value: null }),
	unavailable: async () => ({ ok: false, error: "AuthProviderUnavailable" }),
} satisfies Record<string, RegisterUserPort>;

/** @see {@link signup} */
describe("signup", () => {
	const REGISTRATION = { name: "太郎", email: "a@b.co", password: "12345678" };
	const TEST_CASES = [
		{
			title: "登録できれば、登録されたというイベントを返す",
			args: {
				registerUser: registerUserStubAdapter.created,
				registration: REGISTRATION,
			},
			expected: { ok: true, value: { userId: USER_ID } },
		},
		{
			title: "メールアドレスがもう使われていれば EmailAlreadyRegistered になる",
			args: {
				registerUser: registerUserStubAdapter.emailTaken,
				registration: REGISTRATION,
			},
			expected: { ok: false, error: ["EmailAlreadyRegistered"] },
		},
		{
			title: "認証基盤が答えられなければ AuthProviderUnavailable になる",
			args: {
				registerUser: registerUserStubAdapter.unavailable,
				registration: REGISTRATION,
			},
			expected: { ok: false, error: ["AuthProviderUnavailable"] },
		},
		{
			title: "入力が正しくなければ、登録せずに検証のエラーを返す",
			args: {
				registerUser: registerUserStubAdapter.created,
				registration: { name: "", email: "ab", password: "123" },
			},
			expected: {
				ok: false,
				error: ["UserNameEmpty", "EmailAddressMalformed", "PasswordTooShort"],
			},
		},
	];

	it.each(TEST_CASES)("$title", async ({ args, expected }) => {
		const result = await signup({ registerUser: args.registerUser })({
			registration: args.registration,
		});
		expect(result).toEqual(expected);
	});
});
