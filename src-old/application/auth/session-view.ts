import { SessionView } from "#/domain/auth/operation/session-view/session-view.dto";
import { Result } from "#/domain/building-blocks";
import { currentSession } from "#/external/better-auth/current-session";

/** 現在のセッション → 画面が必要とするログイン状態。 */
export const sessionView = async (): Promise<SessionView> =>
	Result.match(await currentSession(), {
		err: () => SessionView.anonymous,
		ok: SessionView.encode,
	});

/** 読み取りに失敗しても未ログイン表示に落とす。ルートレイアウトで使う。 */
export const sessionViewOrAnonymous = async (): Promise<SessionView> => {
	try {
		return await sessionView();
	} catch {
		return SessionView.anonymous;
	}
};
