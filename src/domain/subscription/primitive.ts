import {
	type AsyncResult,
	err,
	ok,
	type Primitive,
	type Result,
} from "#/domain/building-blocks";

/** 請求 ID。`INV-` + 数字8桁 + `-` + チェックディジット1桁（例: INV-12345678-6）。 */
export type InvoiceId = Primitive<"InvoiceId", string>;

/** 請求 ID として受け付けられない理由。 */
export type InvoiceIdError =
	| "InvoiceIdMalformed"
	| "InvoiceIdCheckDigitMismatch";

export const InvoiceId = {
	create: (input: string): Result<InvoiceId, InvoiceIdError> => {
		const matched = /^INV-(\d{8})-(\d)$/.exec(input);
		if (!matched) return err("InvoiceIdMalformed");
		const [, digits, checkDigit] = matched;
		// チェックディジットは、8桁の数字の和の下1桁。
		const sum = [...digits].reduce((total, digit) => total + Number(digit), 0);
		if (sum % 10 !== Number(checkDigit))
			return err("InvoiceIdCheckDigitMismatch");
		return ok(input as InvoiceId);
	},
	value: (invoiceId: InvoiceId): string => invoiceId,
};

/** 請求額（円）。0 以上の整数。 */
export type Amount = Primitive<"Amount", number>;

/** 請求額として受け付けられない理由。 */
export type AmountError = "AmountNotInteger" | "AmountNegative";

export const Amount = {
	create: (input: number): Result<Amount, AmountError> => {
		if (!Number.isInteger(input)) return err("AmountNotInteger");
		if (input < 0) return err("AmountNegative");
		return ok(input as Amount);
	},
	value: (amount: Amount): number => amount,
};

/** 請求を発行した日時。 */
export type IssuedAt = Primitive<"IssuedAt", Date>;

/** 発行日時として受け付けられない理由。 */
export type IssuedAtError = "IssuedAtInvalid";

export const IssuedAt = {
	/** ISO 8601 の文字列（例: 2026-10-11T13:00:00+09:00）を受け取る。 */
	create: (input: string): Result<IssuedAt, IssuedAtError> => {
		const date = new Date(input);
		if (Number.isNaN(date.getTime())) return err("IssuedAtInvalid");
		return ok(date as IssuedAt);
	},
	value: (issuedAt: IssuedAt): Date => issuedAt,
};

/** 請求。 */
export type Invoice = {
	id: InvoiceId;
	amount: Amount;
	issuedAt: IssuedAt;
};

/** 保存先から請求を読めなかった理由。 */
export type FindInvoiceError = "StoreUnavailable" | "StoredInvoiceMalformed";

/** 請求を ID で探すポート。見つからなければ null。 */
export type FindInvoicePort = (
	id: InvoiceId,
) => AsyncResult<Invoice | null, FindInvoiceError>;

/** メールアドレス。前後の空白は取り除く。 */
export type EmailAddress = Primitive<"EmailAddress", string>;

/** メールアドレスとして受け付けられない理由。 */
export type EmailAddressError = "EmailAddressEmpty" | "EmailAddressMalformed";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const EmailAddress = {
	create: (input: string): Result<EmailAddress, EmailAddressError> => {
		const trimmed = input.trim();
		if (trimmed === "") return err("EmailAddressEmpty");
		if (!EMAIL_PATTERN.test(trimmed)) return err("EmailAddressMalformed");
		return ok(trimmed as EmailAddress);
	},
	value: (email: EmailAddress): string => email,
};

/** パスワード。8文字以上。 */
export type Password = Primitive<"Password", string>;

/** パスワードとして受け付けられない理由。 */
export type PasswordError = "PasswordEmpty" | "PasswordTooShort";

const PASSWORD_MIN_LENGTH = 8;

export const Password = {
	create: (input: string): Result<Password, PasswordError> => {
		if (input === "") return err("PasswordEmpty");
		if (input.length < PASSWORD_MIN_LENGTH) return err("PasswordTooShort");
		return ok(input as Password);
	},
	value: (password: Password): string => password,
};

/** まだ検証していない資格情報（メールアドレスとパスワードの組）。 */
export type UnvalidatedCredentials = { email: string; password: string };

/** 検証済みの資格情報。 */
export type ValidatedCredentials = { email: EmailAddress; password: Password };

/** 資格情報として受け付けられない理由。 */
export type CredentialsError = EmailAddressError | PasswordError;

/** 資格情報を検証する。失敗は1つ目で止めず、すべて集めて返す。 */
export const validateCredentials = (
	credentials: UnvalidatedCredentials,
): Result<ValidatedCredentials, CredentialsError[]> => {
	const email = EmailAddress.create(credentials.email);
	const password = Password.create(credentials.password);
	if (email.ok && password.ok)
		return ok({ email: email.value, password: password.value });
	return err([email, password].flatMap((r) => (r.ok ? [] : [r.error])));
};

/** 利用者の ID。認証基盤が採番する、1 以上の整数。 */
export type UserId = Primitive<"UserId", number>;

/** 利用者の ID として受け付けられない理由。 */
export type UserIdError = "UserIdNotInteger" | "UserIdNotPositive";

export const UserId = {
	create: (input: number): Result<UserId, UserIdError> => {
		if (!Number.isInteger(input)) return err("UserIdNotInteger");
		if (input < 1) return err("UserIdNotPositive");
		return ok(input as UserId);
	},
	value: (userId: UserId): number => userId,
};

/** ログインのワークフローを起こすコマンド。中身は、まだ検証していない資格情報。 */
export type LoginCommand = { credentials: UnvalidatedCredentials };

/** ログインできたというイベント。 */
export type LoggedIn = { userId: UserId };

/** 認証基盤に照合してもらえなかった理由。 */
export type VerifyCredentialsError =
	| "AuthProviderUnavailable"
	| "AuthProviderMalformed";

/** 資格情報を照合するポート。合えば利用者の ID を、合わなければ null を返す。 */
export type VerifyCredentialsPort = (
	credentials: ValidatedCredentials,
) => AsyncResult<UserId | null, VerifyCredentialsError>;

/** ログインできなかった理由。 */
export type LoginError =
	| CredentialsError
	| "AuthenticationFailed"
	| VerifyCredentialsError;

/** ログインのワークフロー。 */
export type LoginWorkflow = (
	command: LoginCommand,
) => AsyncResult<LoggedIn, LoginError[]>;

/** login が使うポート。 */
export type LoginPorts = { verifyCredentials: VerifyCredentialsPort };

/** ログインする。資格情報を検証し、認証基盤に照合してもらい、ログインできたことをイベントとして返す。 */
export const login =
	({ verifyCredentials }: LoginPorts): LoginWorkflow =>
	async ({ credentials }) => {
		const validated = validateCredentials(credentials);
		if (!validated.ok) return validated;
		const userId = await verifyCredentials(validated.value);
		if (!userId.ok) return err([userId.error]);
		if (userId.value === null) return err(["AuthenticationFailed"]);
		return ok({ userId: userId.value });
	};

/** 利用者の名前。前後の空白は取り除く。 */
export type UserName = Primitive<"UserName", string>;

/** 利用者の名前として受け付けられない理由。 */
export type UserNameError = "UserNameEmpty";

export const UserName = {
	create: (input: string): Result<UserName, UserNameError> => {
		const trimmed = input.trim();
		if (trimmed === "") return err("UserNameEmpty");
		return ok(trimmed as UserName);
	},
	value: (userName: UserName): string => userName,
};

/** まだ検証していない、新規登録の入力（名前と資格情報）。 */
export type UnvalidatedRegistration = { name: string } & UnvalidatedCredentials;

/** 検証済みの、新規登録の入力。 */
export type ValidatedRegistration = { name: UserName } & ValidatedCredentials;

/** 新規登録の入力として受け付けられない理由。 */
export type RegistrationError = UserNameError | CredentialsError;

/** 新規登録の入力を検証する。失敗は1つ目で止めず、すべて集めて返す。 */
export const validateRegistration = (
	registration: UnvalidatedRegistration,
): Result<ValidatedRegistration, RegistrationError[]> => {
	const name = UserName.create(registration.name);
	const credentials = validateCredentials(registration);
	if (name.ok && credentials.ok)
		return ok({ name: name.value, ...credentials.value });
	return err([
		...(name.ok ? [] : [name.error]),
		...(credentials.ok ? [] : credentials.error),
	]);
};

/** 新規登録のワークフローを起こすコマンド。中身は、まだ検証していない登録の内容。 */
export type SignupCommand = { registration: UnvalidatedRegistration };

/** 利用者が登録されたというイベント。 */
export type Registered = { userId: UserId };

/** 認証基盤に登録してもらえなかった理由。 */
export type RegisterUserError =
	| "AuthProviderUnavailable"
	| "AuthProviderMalformed";

/**
 * 利用者を登録するポート。
 * 登録できれば利用者の ID を、メールアドレスがもう使われていて登録しなかったときは null を返す。
 */
export type RegisterUserPort = (
	registration: ValidatedRegistration,
) => AsyncResult<UserId | null, RegisterUserError>;

/** 新規登録できなかった理由。 */
export type SignupError =
	| RegistrationError
	| "EmailAlreadyRegistered"
	| RegisterUserError;

/** 新規登録のワークフロー。 */
export type SignupWorkflow = (
	command: SignupCommand,
) => AsyncResult<Registered, SignupError[]>;

/** signup が使うポート。 */
export type SignupPorts = { registerUser: RegisterUserPort };

/** 新規登録する。入力を検証し、認証基盤に登録してもらい、登録できたことをイベントとして返す。 */
export const signup =
	({ registerUser }: SignupPorts): SignupWorkflow =>
	async ({ registration }) => {
		const validated = validateRegistration(registration);
		if (!validated.ok) return validated;
		const userId = await registerUser(validated.value);
		if (!userId.ok) return err([userId.error]);
		if (userId.value === null) return err(["EmailAlreadyRegistered"]);
		return ok({ userId: userId.value });
	};
