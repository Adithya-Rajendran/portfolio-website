import type { ChangeEvent } from "react";

/**
 * A segmented control (contract §4): a radio group drawn as joined
 * hairline boxes, the chosen one filled with an orange dot (the theme
 * toggle's grammar, `.seg` in styles/components.css). Each option can show
 * a plain name under its label ("VOID / Dark").
 *
 * Directive-free: a Server Component renders it uncontrolled
 * (`defaultValue`) and a page island listens for `change` on the group's
 * `name`; a client component can pass `value` and `onChange`. The inputs
 * sit inside their labels, so no ids are needed and a page kept mounted
 * but hidden by Cache Components cannot collide with the visible one.
 * Radios need JavaScript to do anything, so callers add `js-only` when
 * nothing else reads them.
 */

export interface SegmentedOption {
    value: string;
    label: string;
    /** A second, plain name under the label. */
    sub?: string;
}

export default function Segmented({
    legend,
    name,
    options,
    value,
    defaultValue,
    onChange,
    className,
}: {
    /** The group's name for assistive technology (visually hidden). */
    legend: string;
    name: string;
    options: readonly SegmentedOption[];
    value?: string;
    defaultValue?: string;
    onChange?: (value: string, event: ChangeEvent<HTMLInputElement>) => void;
    className?: string;
}) {
    return (
        <fieldset className={className ? `seg ${className}` : "seg"}>
            <legend className="sr-only">{legend}</legend>
            {options.map((option) => (
                <label className="seg__opt" key={option.value}>
                    <input
                        className="seg__input"
                        type="radio"
                        name={name}
                        value={option.value}
                        {...(value === undefined
                            ? { defaultChecked: option.value === defaultValue }
                            : { checked: option.value === value })}
                        onChange={
                            onChange
                                ? (event) => onChange(option.value, event)
                                : undefined
                        }
                    />
                    <span
                        className={
                            option.sub ? "seg__box seg__box--pair" : "seg__box"
                        }
                    >
                        <span className="seg__label">{option.label}</span>
                        {option.sub ? (
                            <span className="seg__sub">{option.sub}</span>
                        ) : null}
                    </span>
                </label>
            ))}
        </fieldset>
    );
}
