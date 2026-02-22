import { Link } from "react-router-dom";
import { APP_NAME } from "@/config/brand";
import logoImg from "@/assets/logo.png";

type LogoVariant = "landing" | "header" | "inline";

interface LogoProps {
  variant?: LogoVariant;
  /** When true, the logo is wrapped in a link to home. Default true for header/inline, false for landing. */
  linkToHome?: boolean;
  className?: string;
}

export function Logo({ variant = "header", linkToHome, className = "" }: LogoProps) {
  const asLink = linkToHome ?? (variant !== "landing");
  const content = (
    <>
      <img
        src={logoImg}
        alt=""
        className={
          variant === "landing"
            ? "h-24 w-24 rounded-2xl object-contain shadow-lg"
            : variant === "header"
              ? "h-8 w-8 rounded-lg object-contain"
              : "h-6 w-6 rounded object-contain inline-block align-middle"
        }
      />
      {(variant === "header" || variant === "inline") && (
        <span className={variant === "inline" ? "ml-2 align-middle" : "ml-2"}>
          {variant === "inline" ? "← " : ""}{APP_NAME}
        </span>
      )}
    </>
  );

  const wrapperClass =
    variant === "landing"
      ? `flex flex-col items-center ${className}`
      : variant === "header"
        ? `inline-flex items-center font-semibold text-clinical-primary text-lg tracking-tight ${className}`
        : `inline-flex items-center text-clinical-primary font-semibold ${className}`;

  if (asLink) {
    return (
      <Link to="/" className={wrapperClass}>
        {content}
      </Link>
    );
  }
  return <div className={wrapperClass}>{content}</div>;
}
