// 2026/10/11 13:00 の形。サーバーとブラウザで表示がずれないよう、タイムゾーンを固定する
const DATE_TIME_FORMAT = new Intl.DateTimeFormat("ja-JP", {
	timeZone: "Asia/Tokyo",
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
	hour: "2-digit",
	minute: "2-digit",
});

/** 日時を画面に出す形にする。Date のブランド型もそのまま渡せる。 */
export const formatDateTime = (date: Date): string =>
	DATE_TIME_FORMAT.format(date);
