import ReactDatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { Calendar } from "lucide-react";

interface DatePickerProps {
  selected: Date | null;
  onChange: (date: Date | null) => void;
  showTimeSelect?: boolean;
  dateFormat?: string;
  placeholderText?: string;
  required?: boolean;
  minDate?: Date;
  className?: string;
}

export default function DatePicker({
  selected,
  onChange,
  showTimeSelect = false,
  dateFormat,
  placeholderText = "Select date",
  required,
  minDate,
  className = "",
}: DatePickerProps) {
  const fmt =
    dateFormat ?? (showTimeSelect ? "MMM d, yyyy h:mm aa" : "MMM d, yyyy");

  return (
    <div className={`relative ${className}`}>
      <ReactDatePicker
        selected={selected}
        onChange={onChange}
        showTimeSelect={showTimeSelect}
        timeIntervals={15}
        dateFormat={fmt}
        placeholderText={placeholderText}
        required={required}
        minDate={minDate}
        className="input-field w-full pl-10 cursor-pointer"
        calendarClassName="dark-calendar"
        popperClassName="datepicker-popper"
        popperPlacement="bottom-start"
        portalId="root"
        showPopperArrow={false}
        autoComplete="off"
      />
      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
    </div>
  );
}
