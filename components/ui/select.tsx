"use client";

import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { Icon } from "@/components/ui/icon";
import { controlClassName } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Option = {
  value: string;
  label: string;
  disabled?: boolean;
};

function isPrompt(option: Option): boolean {
  return option.value === "" && /^select\b/i.test(option.label.trim());
}

function readOptions(children: ReactNode): Option[] {
  const options: Option[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child) || child.type !== "option") {
      return;
    }
    const props = child.props as {
      value?: string | number;
      children?: ReactNode;
      disabled?: boolean;
    };
    options.push({
      disabled: props.disabled,
      label: String(props.children ?? ""),
      value: String(props.value ?? ""),
    });
  });
  return options;
}

function firstEnabledIndex(items: Option[], start: number): number {
  if (items.length === 0) {
    return 0;
  }
  if (!items[start]?.disabled) {
    return start;
  }
  for (let offset = 1; offset < items.length; offset++) {
    const down = start + offset;
    if (down < items.length && !items[down]?.disabled) {
      return down;
    }
    const up = start - offset;
    if (up >= 0 && !items[up]?.disabled) {
      return up;
    }
  }
  return start;
}

function moveEnabledIndex(items: Option[], current: number, delta: number): number {
  if (items.length === 0) {
    return 0;
  }
  let next = current;
  for (let step = 0; step < items.length; step++) {
    next = Math.max(0, Math.min(items.length - 1, next + delta));
    if (!items[next]?.disabled) {
      return next;
    }
    if (next === 0 && delta < 0) {
      break;
    }
    if (next === items.length - 1 && delta > 0) {
      break;
    }
  }
  return current;
}

export function Select({
  children,
  className,
  defaultValue,
  disabled,
  id,
  name,
  required,
}: Pick<
  SelectHTMLAttributes<HTMLSelectElement>,
  "className" | "defaultValue" | "disabled" | "id" | "name" | "required"
> & { children: ReactNode }) {
  const options = readOptions(children);
  const prompt = options.find(isPrompt);
  const items = options.filter((option) => !isPrompt(option));
  const generatedId = useId();
  const triggerId = id ?? generatedId;
  const listId = `${triggerId}-list`;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const initial =
    defaultValue == null ? (prompt?.value ?? items[0]?.value ?? "") : String(defaultValue);
  const [value, setValue] = useState(initial);
  const [open, setOpen] = useState(false);
  const selectedItemIndex = items.findIndex((option) => option.value === value);
  const [activeIndex, setActiveIndex] = useState(
    firstEnabledIndex(items, Math.max(0, selectedItemIndex)),
  );
  const selected = items.find((option) => option.value === value);
  const triggerLabel = selected?.label ?? prompt?.label ?? "";
  const showingPrompt = !selected;

  useEffect(() => {
    if (!open) {
      return;
    }
    listRef.current?.focus();
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        closeList();
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  function closeList() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  function choose(index: number) {
    const option = items[index];
    if (!option || option.disabled) {
      return;
    }
    setValue(option.value);
    setActiveIndex(index);
    closeList();
  }

  function openList() {
    setActiveIndex(firstEnabledIndex(items, Math.max(0, selectedItemIndex)));
    setOpen(true);
  }

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (
      event.key === "ArrowDown" ||
      event.key === "ArrowUp" ||
      event.key === "Enter" ||
      event.key === " "
    ) {
      event.preventDefault();
      openList();
    }
  }

  function onListKeyDown(event: KeyboardEvent<HTMLUListElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeList();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => moveEnabledIndex(items, current, 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => moveEnabledIndex(items, current, -1));
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(firstEnabledIndex(items, 0));
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(firstEnabledIndex(items, items.length - 1));
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose(activeIndex);
    }
  }

  return (
    <div className="relative" ref={rootRef}>
      {name ? (
        <input name={name} required={required} type="hidden" value={value} />
      ) : null}
      <button
        ref={triggerRef}
        aria-controls={listId}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={cn(
          controlClassName,
          "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-left leading-none appearance-none",
          className,
        )}
        disabled={disabled}
        id={triggerId}
        type="button"
        onClick={() => {
          if (open) {
            closeList();
            return;
          }
          openList();
        }}
        onKeyDown={onTriggerKeyDown}
      >
        <span
          className={cn("min-w-0 truncate", showingPrompt && "text-muted-foreground")}
        >
          {triggerLabel}
        </span>
        <Icon className="size-4 shrink-0 text-muted-foreground" name="chevron-down" />
      </button>
      {open ? (
        <ul
          aria-activedescendant={`${triggerId}-opt-${activeIndex}`}
          aria-labelledby={triggerId}
          className="absolute z-20 mt-1 max-h-popover w-full overflow-y-auto rounded-md border border-border-strong bg-popover py-1 shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          id={listId}
          ref={listRef}
          role="listbox"
          tabIndex={-1}
          onKeyDown={onListKeyDown}
        >
          {items.map((option, index) => {
            const active = index === activeIndex;
            const isSelected = option.value === value;
            return (
              <li
                aria-disabled={option.disabled || undefined}
                aria-selected={isSelected}
                className={cn(
                  "cursor-pointer px-3 py-2 text-sm text-foreground",
                  active && "bg-muted",
                  isSelected && "bg-primary-subtle text-primary-subtle-foreground",
                  option.disabled && "cursor-not-allowed text-muted-foreground",
                )}
                id={`${triggerId}-opt-${index}`}
                key={`${option.value}-${index}`}
                role="option"
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => {
                  if (!option.disabled) {
                    setActiveIndex(index);
                  }
                }}
                onClick={() => choose(index)}
              >
                {option.label}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
