/** Fake officers and awards (ids follow migrations/0002: units 1..10, teams 1..13). */

interface DemoOfficer {
  id: number;
  name: string;
  birthYear: number;
  badge: string;
  rankId: number;
  positionId: number;
  unitId: number;
  teamId: number | null;
  joined: string | null;
  ratingId: number | null;
}

const o = (
  id: number,
  name: string,
  birthYear: number,
  rankId: number,
  positionId: number,
  unitId: number,
  teamId: number | null,
  joined: string | null,
  ratingId: number | null,
): DemoOfficer => ({
  id,
  name,
  birthYear,
  badge: String(100100 + id),
  rankId,
  positionId,
  unitId,
  teamId,
  joined,
  ratingId,
});

export const DEMO_OFFICERS: readonly DemoOfficer[] = [
  o(1, "Nguyễn Văn Hùng", 1985, 8, 5, 6, 1, "2008-09", 1),
  o(2, "Trần Thị Lan Anh", 1990, 7, 7, 6, 1, "2013-07", 2),
  o(3, "Lê Quang Minh", 1988, 8, 6, 6, 2, "2010-08", 1),
  o(4, "Phạm Thanh Tùng", 1993, 6, 7, 6, 2, "2016-06", 2),
  o(5, "Hoàng Đức Long", 1980, 9, 2, 6, null, "2003-09", 1),
  o(6, "Vũ Thị Hạnh", 1992, 7, 7, 6, 8, "2015-07", 3),
  o(7, "Đặng Văn Khoa", 1987, 8, 5, 6, 10, "2009-05", 2),
  o(8, "Bùi Ngọc Sơn", 1995, 5, 7, 7, 12, "2018-08", null),
  o(9, "Ngô Thị Phương", 1991, 6, 7, 7, 13, "2014-09", 2),
  o(10, "Đỗ Mạnh Cường", 1978, 10, 1, 7, null, "2000-10", 1),
  o(11, "Phan Văn Bình", 1989, 7, 7, 3, null, "2011-07", 3),
  o(12, "Lý Thanh Hải", 1983, 8, 3, 9, null, "2005-08", 1),
  o(13, "Trương Minh Đạt", 1994, 4, 7, 6, 1, null, null),
];

interface DemoAward {
  officerId: number | null;
  unitId: number;
  teamId: number | null;
  typeId: number;
  variantId: number | null;
  year: number;
  decision: string;
  date: string;
  authorityId: number;
  achievement: string;
}

const a = (
  officerId: number | null,
  unitId: number,
  teamId: number | null,
  typeId: number,
  variantId: number | null,
  year: number,
  decision: string,
  date: string,
  authorityId: number,
  achievement: string,
): DemoAward => ({
  officerId,
  unitId,
  teamId,
  typeId,
  variantId,
  year,
  decision,
  date,
  authorityId,
  achievement,
});

const XS = "Hoàn thành xuất sắc nhiệm vụ";

/** Insertion order = oldest first; the list shows year DESC then newest first. */
export const DEMO_AWARDS: readonly DemoAward[] = [
  a(
    12,
    9,
    null,
    9,
    2,
    2023,
    "210/QĐ-CTN",
    "2023-08-20",
    1,
    "Thành tích bảo đảm an toàn giao thông thủy",
  ),
  a(9, 7, 13, 6, null, 2023, "300/QĐ-BCA", "2023-12-05", 3, XS),
  a(7, 6, 10, 12, null, 2024, "15/QĐ-P6", "2024-03-10", 4, "Có thành tích trong đợt cao điểm Tết"),
  a(8, 7, 12, 8, null, 2024, "60/QĐ-P7", "2024-12-20", 4, XS),
  a(null, 9, null, 4, null, 2024, "07/QĐ-TD1", "2024-12-25", 4, "Hoàn thành tốt nhiệm vụ năm 2024"),
  a(1, 6, 1, 11, null, 2024, "340/QĐ-BCA", "2024-11-02", 3, "Thành tích xuất sắc trong chuyên án"),
  a(1, 6, 1, 7, null, 2025, "97/QĐ-P6", "2025-12-18", 4, XS),
  a(3, 6, 2, 7, null, 2025, "98/QĐ-P6", "2025-12-18", 4, XS),
  a(
    null,
    6,
    null,
    2,
    null,
    2025,
    "1020/QĐ-BCA",
    "2025-10-30",
    3,
    "Dẫn đầu phong trào thi đua năm 2025",
  ),
  a(10, 7, null, 10, null, 2025, "512/QĐ-TTg", "2025-07-15", 2, "Thành tích công tác nhiều năm"),
  a(
    5,
    6,
    null,
    9,
    6,
    2025,
    "45/QĐ-CTN",
    "2025-09-02",
    1,
    "Thành tích xuất sắc trong bảo vệ an ninh trật tự",
  ),
  a(
    null,
    7,
    null,
    3,
    null,
    2025,
    "88/QĐ-P7",
    "2025-12-28",
    4,
    "Quyết thắng trong phong trào thi đua",
  ),
  a(1, 6, 1, 7, null, 2026, "125/QĐ-P6", "2026-09-15", 4, `${XS} năm 2026`),
  a(2, 6, 1, 8, null, 2026, "126/QĐ-P6", "2026-09-15", 4, "Có thành tích tiêu biểu năm 2026"),
  a(
    null,
    6,
    1,
    4,
    null,
    2026,
    "130/QĐ-P6",
    "2026-09-20",
    4,
    "Đội hoàn thành tốt nhiệm vụ năm 2026",
  ),
];
