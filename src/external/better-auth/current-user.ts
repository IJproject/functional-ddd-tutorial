import { getRequestHeaders } from "@tanstack/react-start/server";
import { UserId } from "#/domain/auth/model/user.primitive";
import { auth } from "#/external/better-auth/auth";

/**
 * 表示用の現在ユーザー。
 *
 * ドメインの型ではなく境界層の形であることに注意。名前とメールは認証基盤が持つ
 * 表示データで、auth BC のワークフローはどちらも必要としない。ドメインの
 * AuthenticatedUser に足すと login / signup 両方のアダプタに波及するため、
 * 画面表示のためだけの型をここに置く。
 */
export type CurrentUser = {
	userId: UserId;
	name: string;
	email: string;
};

export const currentUser = async (): Promise<CurrentUser | null> => {
	const session = await auth.api.getSession({ headers: getRequestHeaders() });
	return session
		? {
				userId: UserId.create(session.user.id),
				name: session.user.name,
				email: session.user.email,
			}
		: null;
};
