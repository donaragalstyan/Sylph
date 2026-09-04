import { render, screen, fireEvent } from "@testing-library/react-native";
import { LoadingState, ErrorState, EmptyState } from "./StateViews";

describe("StateViews", () => {
  it("renders a loading indicator with its label", async () => {
    await render(<LoadingState label="Loading your closet…" />);
    expect(screen.getByTestId("loading-state")).toBeTruthy();
    expect(screen.getByText("Loading your closet…")).toBeTruthy();
  });

  it("renders an error message and invokes retry on tap", async () => {
    const onRetry = jest.fn();
    await render(<ErrorState message="Couldn't load your closet." onRetry={onRetry} />);

    expect(screen.getByText("Couldn't load your closet.")).toBeTruthy();
    fireEvent.press(screen.getByText("Try again"));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("renders an empty state title and message", async () => {
    await render(<EmptyState title="Your closet is empty" message="Tap + to add your first piece." />);
    expect(screen.getByText("Your closet is empty")).toBeTruthy();
    expect(screen.getByText("Tap + to add your first piece.")).toBeTruthy();
  });
});
