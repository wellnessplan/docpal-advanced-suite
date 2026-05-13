import * as React from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter, SheetClose } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Filter } from "lucide-react";

interface MobileFilterSheetProps {
  children: React.ReactNode;
  title?: string;
  triggerLabel?: string;
  activeCount?: number;
  onApply?: () => void;
  onReset?: () => void;
}

/** Mobile bottom-sheet wrapper for filter controls. Use only when isMobile. */
export function MobileFilterSheet({
  children,
  title = "Filters",
  triggerLabel = "Filters",
  activeCount = 0,
  onApply,
  onReset,
}: MobileFilterSheetProps) {
  const [open, setOpen] = React.useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-1.5 relative">
          <Filter className="h-4 w-4" />
          {triggerLabel}
          {activeCount > 0 && (
            <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground px-1.5">
              {activeCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto safe-area-bottom">
        <SheetHeader>
          <SheetTitle className="text-left">{title}</SheetTitle>
        </SheetHeader>
        <div className="py-4 space-y-4">{children}</div>
        <SheetFooter className="flex-row gap-2 pt-2">
          {onReset && (
            <Button variant="outline" className="flex-1" onClick={() => { onReset(); }}>
              Reset
            </Button>
          )}
          <SheetClose asChild>
            <Button className="flex-1" onClick={onApply}>Apply</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
