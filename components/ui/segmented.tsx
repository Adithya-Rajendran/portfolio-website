import { useId, type ChangeEvent } from "react";

/**
 * A segmented control (contract §4): a radio group drawn as joined
 * hairline boxes, the chosen one filled with an ink dot (the theme
 * toggle's grammar, `.seg` in styles/components.css). An option can carry
 * a description under its label (the contact form's topics, stacked one
 * per line by their caller): the radio is named by its label alone and
 * described by the rest.
 *
 * Directive-free: a Server Component renders it uncontrolled
 * (`defaultValue`) and a page island listens for `change` on the group's
 * `name`; a client component can pass `value` and `onChange`. The inputs
 * sit inside their labels; a description's ids come from `useId`, so a
 * page kept mounted but hidden by Cache Components cannot collide with
 * the visible one. Radios need JavaScript to do anything, so callers add
 * `js-only` when nothing else reads them.
 */

interface SegmentedOption {
    value: string;
    label: string;
    /** A line under the label, read as the radio's description. */
    description?: string;
}

export default function Segmented({
    legend,
    name,
    options,
    value,
    defaultValue,
    onChange,
    legendClassName,
    className,
}: {
    /** The group's name: read by assistive technology only, unless
     *  `legendClassName` sets it as a visible label (a form field's). */
    legend: React.ReactNode;
    legendClassName?: string;
    name: string;
    options: readonly SegmentedOption[];
    value?: string;
    defaultValue?: string;
    onChange?: (value: string, event: ChangeEvent<HTMLInputElement>) => void;
    className?: string;
}) {
    const id = useId();
    return (
        <fieldset className={className ? `seg ${className}` : "seg"}>
            <legend
                className={
                    legendClassName
                        ? `seg__legend ${legendClassName}`
                        : "sr-only"
                }
            >
                {legend}
            </legend>
            {options.map((option) => {
                const ids = option.description
                    ? {
                          label: `${id}-${option.value}`,
                          description: `${id}-${option.value}-d`,
                      }
                    : null;
                return (
                    <label className="seg__opt" key={option.value}>
                        <input
                            className="seg__input"
                            type="radio"
                            name={name}
                            value={option.value}
                            {...(value === undefined
                                ? {
                                      defaultChecked:
                                          option.value === defaultValue,
                                  }
                                : { checked: option.value === value })}
                            onChange={
                                onChange
                                    ? (event) => onChange(option.value, event)
                                    : undefined
                            }
                            aria-labelledby={ids?.label}
                            aria-describedby={ids?.description}
                        />
                        <span
                            className={
                                ids ? "seg__box seg__box--note" : "seg__box"
                            }
                        >
                            <span className="seg__label" id={ids?.label}>
                                {option.label}
                            </span>
                            {ids ? (
                                <span
                                    className="seg__note"
                                    id={ids.description}
                                >
                                    {option.description}
                                </span>
                            ) : null}
                        </span>
                    </label>
                );
            })}
        </fieldset>
    );
}
