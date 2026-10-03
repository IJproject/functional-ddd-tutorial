import { UserId } from "#/domain/auth/model/user.primitive";
import { AccountId } from "#/domain/subscription/model/account.primitive";

// auth BC と subscription BC の対応関係。
// 利用者（User）と契約者（Account）は 1 対 1 で、同じ ID を使う。
// これは配線ではなく業務上の決めごとなので domain に置く。
// 両 BC を知るのはこのフォルダだけで、auth / subscription からは import しない。
// 使うのは両 BC を組み立てる routes と external に限る。

/** auth BC の利用者 ID を subscription BC の契約者 ID に翻訳する。 */
export const toAccountId = (userId: UserId): AccountId =>
	AccountId.create(UserId.value(userId));
