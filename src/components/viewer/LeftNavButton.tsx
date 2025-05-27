import React from "react";
import { Icons } from "../../components/ui/icons";
import { Button } from "../../components/ui/button";

export function LeftNavButton() {
  return (
    <div className="bg-primary-dark flex flex-col items-center justify-center w-10 border-r border-border-dark shrink-0">
      <Button
        variant="icon"
        size="icon"
        className="text-text-secondary hover:text-text-primary"
      >
        <Icons.ChevronLeft size={20} />
      </Button>
    </div>
  );
}
