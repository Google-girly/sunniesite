"use client";

import { useState } from "react";

// A plain <input type="password"> plus a show/hide toggle — used
// anywhere someone types in (or sets) a password: /login, /signup,
// Manage Officers & Logins. `inputClassName` is the exact class string
// the page already used on its bare <input>; this just wraps it in a
// relative container and adds the toggle button, so swapping this in
// doesn't change any page's existing look.
export function PasswordInput({
  id,
  value,
  onChange,
  inputClassName,
  autoFocus,
  placeholder,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  inputClassName: string;
  autoFocus?: boolean;
  placeholder?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        id={id}
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoFocus={autoFocus}
        placeholder={placeholder}
        className={`${inputClassName} pr-14`}
      />
      <button
        type="button"
        onClick={() => setVisible((prev) => !prev)}
        tabIndex={-1}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium text-stone-400 hover:text-stone-700"
      >
        {visible ? "Hide" : "Show"}
      </button>
    </div>
  );
}
