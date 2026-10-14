import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { Placeholder } from "../../src/client/placeholder";

it("renders the app title", () => {
  render(<Placeholder />);
  expect(screen.getByRole("heading")).toHaveTextContent("quản lý thi đua");
});
