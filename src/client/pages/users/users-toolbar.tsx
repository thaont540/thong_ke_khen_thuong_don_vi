interface Props {
  search: string;
  onSearch: (value: string) => void;
  onAdd: () => void;
}

export function UsersToolbar({ search, onSearch, onAdd }: Props) {
  return (
    <>
      <div className="head">
        <div>
          <h1>Quản lý người dùng</h1>
          <p className="sub">Tài khoản đăng nhập và vai trò của người dùng trong hệ thống</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={onAdd}>
          Thêm người dùng
        </button>
      </div>
      <div className="toolbar">
        <div className="field field-wide">
          <label htmlFor="users-search">Tìm kiếm</label>
          <input
            id="users-search"
            type="search"
            placeholder="Tên đăng nhập hoặc họ tên"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
          />
        </div>
      </div>
    </>
  );
}
