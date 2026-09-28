import { cx } from "./ui";

/** Bullet's seats at a glance: filled = taken, highlighted = yours. */
export function SeatMap({ capacity, taken, mine = 0 }: { capacity: number; taken: number; mine?: number }) {
  return (
    <div className="flex items-center gap-1.5" aria-label={`${taken} of ${capacity} seats taken`}>
      {Array.from({ length: capacity }, (_, i) => {
        const isMine = i < mine;
        const isTaken = i < taken;
        return (
          <span
            key={i}
            className={cx(
              "grid size-7 place-items-center rounded-md border text-[10px] font-bold",
              isMine
                ? "border-brand bg-brand text-white"
                : isTaken
                  ? "border-ink/20 bg-ink/15 text-ink/60"
                  : "border-dashed border-line bg-white text-muted",
            )}
          >
            {isMine ? "YOU" : isTaken ? "●" : ""}
          </span>
        );
      })}
      <span className="ml-1 text-xs text-muted">
        {capacity - taken} of {capacity} free
      </span>
    </div>
  );
}
