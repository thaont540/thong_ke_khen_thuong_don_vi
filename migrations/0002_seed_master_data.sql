-- Master data seed (docs/schema-seed.sql §5).
-- Đơn vị: 8 phòng + 2 thủy đoàn
INSERT INTO units (id, code, name, kind, sort_order) VALUES
  (1,  'P1',  'Phòng 1',      'PHONG',     1),
  (2,  'P2',  'Phòng 2',      'PHONG',     2),
  (3,  'P3',  'Phòng 3',      'PHONG',     3),
  (4,  'P4',  'Phòng 4',      'PHONG',     4),
  (5,  'P5',  'Phòng 5',      'PHONG',     5),
  (6,  'P6',  'Phòng 6',      'PHONG',     6),
  (7,  'P7',  'Phòng 7',      'PHONG',     7),
  (8,  'P8',  'Phòng 8',      'PHONG',     8),
  (9,  'TD1', 'Thủy đoàn I',  'THUY_DOAN', 9),
  (10, 'TD2', 'Thủy đoàn II', 'THUY_DOAN', 10);

-- Đội: 11 đội thuộc Phòng 6, 2 đội thuộc Phòng 7
INSERT INTO teams (id, unit_id, code, name, sort_order) VALUES
  (1,  6, 'P6-CT1',  'Đội CSGT đường bộ cao tốc số 1', 1),
  (2,  6, 'P6-CT2',  'Đội CSGT đường bộ cao tốc số 2', 2),
  (3,  6, 'P6-CT3',  'Đội CSGT đường bộ cao tốc số 3', 3),
  (4,  6, 'P6-CT4',  'Đội CSGT đường bộ cao tốc số 4', 4),
  (5,  6, 'P6-CT5',  'Đội CSGT đường bộ cao tốc số 5', 5),
  (6,  6, 'P6-CT6',  'Đội CSGT đường bộ cao tốc số 6', 6),
  (7,  6, 'P6-CT7',  'Đội CSGT đường bộ cao tốc số 7', 7),
  (8,  6, 'P6-TMTH', 'Đội Tham mưu tổng hợp', 8),
  (9,  6, 'P6-HDKT', 'Đội Hướng dẫn kiểm tra hoạt động TTKS giao thông đường bộ, đường sắt', 9),
  (10, 6, 'P6-DS1',  'Đội CSGT đường sắt số 1', 10),
  (11, 6, 'P6-DS2',  'Đội CSGT đường sắt số 2', 11),
  (12, 7, 'P7-DD1',  'Đội Dẫn đoàn số 1', 1),
  (13, 7, 'P7-DD2',  'Đội Dẫn đoàn số 2', 2);

-- Cấp bậc
INSERT INTO ranks (id, code, name, rank_group, sort_order) VALUES
  (1,  'HA_SI',       'Hạ sĩ',        'HA_SI_QUAN', 1),
  (2,  'TRUNG_SI',    'Trung sĩ',     'HA_SI_QUAN', 2),
  (3,  'THUONG_SI',   'Thượng sĩ',    'HA_SI_QUAN', 3),
  (4,  'THIEU_UY',    'Thiếu úy',     'CAP_UY',     4),
  (5,  'TRUNG_UY',    'Trung úy',     'CAP_UY',     5),
  (6,  'THUONG_UY',   'Thượng úy',    'CAP_UY',     6),
  (7,  'DAI_UY',      'Đại úy',       'CAP_UY',     7),
  (8,  'THIEU_TA',    'Thiếu tá',     'CAP_TA',     8),
  (9,  'TRUNG_TA',    'Trung tá',     'CAP_TA',     9),
  (10, 'THUONG_TA',   'Thượng tá',    'CAP_TA',     10),
  (11, 'DAI_TA',      'Đại tá',       'CAP_TA',     11),
  (12, 'THIEU_TUONG', 'Thiếu tướng',  'CAP_TUONG',  12),
  (13, 'TRUNG_TUONG', 'Trung tướng',  'CAP_TUONG',  13),
  (14, 'THUONG_TUONG','Thượng tướng', 'CAP_TUONG',  14),
  (15, 'DAI_TUONG',   'Đại tướng',    'CAP_TUONG',  15);

-- Chức vụ
INSERT INTO positions (id, code, name, level, sort_order) VALUES
  (1, 'TRUONG_PHONG',      'Trưởng phòng',          'DON_VI', 1),
  (2, 'PHO_TRUONG_PHONG',  'Phó Trưởng phòng',      'DON_VI', 2),
  (3, 'THUY_DOAN_TRUONG',  'Thủy đoàn trưởng',      'DON_VI', 3),
  (4, 'PHO_THUY_DOAN_TRUONG', 'Phó Thủy đoàn trưởng', 'DON_VI', 4),
  (5, 'DOI_TRUONG',        'Đội trưởng',            'DOI',    5),
  (6, 'PHO_DOI_TRUONG',    'Phó Đội trưởng',        'DOI',    6),
  (7, 'CAN_BO',            'Cán bộ',                'CAN_BO', 7);

-- Cấp quyết định
INSERT INTO authorities (id, code, name, sort_order) VALUES
  (1, 'CTN', 'Chủ tịch nước',        1),
  (2, 'TTG', 'Thủ tướng Chính phủ',  2),
  (3, 'BCA', 'Bộ trưởng Bộ Công an', 3),
  (4, 'DV',  'Thủ trưởng đơn vị',    4);

-- Danh hiệu thi đua và hình thức khen thưởng
INSERT INTO award_types (id, code, name, form, subject_scope, default_authority_id, requires_variant, sort_order) VALUES
  -- Danh hiệu tập thể
  (1,  'CO_TD_CP',        'Cờ Thi đua của Chính phủ',        'DANH_HIEU',   'TAP_THE', 2, 0, 1),
  (2,  'CO_TD_BCA',       'Cờ thi đua của Bộ Công an',       'DANH_HIEU',   'TAP_THE', 3, 0, 2),
  (3,  'DV_QUYET_THANG',  'Đơn vị quyết thắng',              'DANH_HIEU',   'TAP_THE', 4, 0, 3),
  (4,  'DV_TIEN_TIEN',    'Đơn vị tiên tiến',                'DANH_HIEU',   'TAP_THE', 4, 0, 4),
  -- Danh hiệu cá nhân
  (5,  'CSTD_TOAN_QUOC',  'Chiến sĩ thi đua toàn quốc',      'DANH_HIEU',   'CA_NHAN', 2, 0, 5),
  (6,  'CSTD_TOAN_LL',    'Chiến sĩ thi đua toàn lực lượng', 'DANH_HIEU',   'CA_NHAN', 3, 0, 6),
  (7,  'CSTD_CO_SO',      'Chiến sĩ thi đua cơ sở',          'DANH_HIEU',   'CA_NHAN', 4, 0, 7),
  (8,  'CS_TIEN_TIEN',    'Chiến sĩ tiên tiến',              'DANH_HIEU',   'CA_NHAN', 4, 0, 8),
  -- Hình thức khen thưởng (tập thể và cá nhân)
  (9,  'HUAN_CHUONG',     'Huân chương',                     'KHEN_THUONG', 'CA_HAI',  1, 1, 9),
  (10, 'BK_TTG',          'Bằng khen Thủ tướng Chính phủ',   'KHEN_THUONG', 'CA_HAI',  2, 0, 10),
  (11, 'BK_BCA',          'Bằng khen Bộ Công an',            'KHEN_THUONG', 'CA_HAI',  3, 0, 11),
  (12, 'GIAY_KHEN',       'Giấy khen',                       'KHEN_THUONG', 'CA_HAI',  4, 0, 12);

-- Loại huân chương (cần nghiệp vụ xác nhận và bổ sung)
INSERT INTO award_variants (id, award_type_id, code, name, sort_order) VALUES
  (1, 9, 'HC_BVTQ_1', 'Huân chương Bảo vệ Tổ quốc hạng Nhất', 1),
  (2, 9, 'HC_BVTQ_2', 'Huân chương Bảo vệ Tổ quốc hạng Nhì',  2),
  (3, 9, 'HC_BVTQ_3', 'Huân chương Bảo vệ Tổ quốc hạng Ba',   3),
  (4, 9, 'HC_CC_1',   'Huân chương Chiến công hạng Nhất',     4),
  (5, 9, 'HC_CC_2',   'Huân chương Chiến công hạng Nhì',      5),
  (6, 9, 'HC_CC_3',   'Huân chương Chiến công hạng Ba',       6);
