import { screen } from "@testing-library/react";
import type userEvent from "@testing-library/user-event";
import { listBody, master, officerDetail, officerOption } from "./award-fixtures";
import { makeMe, mockApi } from "./render-with-providers";

export const officers = [
  officerOption(),
  officerOption({
    id: 6,
    code: "CB006",
    full_name: "Trần Thị Bình",
    badge_number: "654321",
    team_id: 2,
  }),
  officerOption({
    id: 7,
    code: "CB007",
    full_name: "Lê Văn Cường",
    badge_number: "111111",
    unit_id: 1,
    team_id: null,
  }),
];

export const setup = (
  extra: Parameters<typeof mockApi>[0] = {},
  role: "ADMIN" | "EDITOR" = "EDITOR",
) =>
  mockApi({
    "GET /api/me": { body: makeMe(role) },
    "GET /api/master": { body: master },
    "GET /api/officers/options": { body: { items: officers } },
    "GET /api/awards": { body: listBody([]) },
    "GET /api/officers/5": { body: officerDetail([]) },
    ...extra,
  });

export const field = (label: RegExp | string) => screen.findByLabelText(label);

export async function fillCommon(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await field(/Số quyết định/), "99/QĐ");
  await user.type(screen.getByLabelText(/Ngày quyết định/), "01/05/2026");
  await user.type(screen.getByLabelText(/Thành tích/), "Thành tích tốt");
}

export async function fillPersonal(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(await field(/Đơn vị/), "6");
  await user.selectOptions(screen.getByLabelText(/Cán bộ/), "5");
  await user.selectOptions(screen.getByLabelText(/Danh hiệu thi đua/), "7");
  await fillCommon(user);
}
