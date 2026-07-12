import { clsx } from 'clsx';
import type { ComponentChildren, JSX } from 'preact';
import s from './ui.module.css';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

type Props = Omit<JSX.IntrinsicElements['button'], 'size'> & {
  variant?: Variant;
  size?: Size;
  icon?: boolean;
  children?: ComponentChildren;
};

/** The one button. Variants map to tokens, so it re-themes for free. Defaults to type="button" so a
 *  button placed inside a <form> never submits it by accident; pass type="submit" to opt in. */
export function Button({ variant = 'secondary', size = 'md', icon = false, class: cls, children, ...rest }: Props) {
  return (
    <button
      type="button"
      class={clsx(s.btn, s[variant], size === 'sm' && s.sm, size === 'lg' && s.lg, icon && s.iconBtn, cls)}
      {...rest}
    >
      {children}
    </button>
  );
}
