import React from 'react';

/**
 * URL detection regex pattern
 * Matches http://, https://, ftp://, and www. URLs
 */
const URL_REGEX = /(https?:\/\/[^\s]+|ftp:\/\/[^\s]+|www\.[^\s]+)/gi;

/**
 * Validates if a URL is properly formatted
 */
const isValidUrl = (url: string): boolean => {
  try {
    new URL(url.startsWith('www.') ? `https://${url}` : url);
    return true;
  } catch {
    return false;
  }
};

/**
 * Converts a detected URL to a proper href
 */
const normalizeUrl = (url: string): string => {
  if (url.startsWith('www.')) {
    return `https://${url}`;
  }
  return url;
};

/**
 * Converts URLs in text to clickable links
 * @param text - The text that may contain URLs
 * @param className - Optional CSS classes for the links
 * @returns React elements with clickable links
 */
export const linkifyText = (text: string, className?: string): React.ReactNode => {
  if (!text) return text;

  const parts = text.split(URL_REGEX);
  
  return parts.map((part, index) => {
    // Check if this part is a URL
    if (URL_REGEX.test(part) && isValidUrl(part)) {
      const href = normalizeUrl(part);
      return (
        <a
          key={index}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={className || "text-blue-500 hover:text-blue-700 underline"}
          onClick={(e) => e.stopPropagation()} // Prevent modal from closing
        >
          {part}
        </a>
      );
    }
    
    return part;
  });
};

/**
 * Renders a single URL as a clickable link
 * @param url - The URL to render
 * @param displayText - Optional custom display text (defaults to URL)
 * @param className - Optional CSS classes for the link
 */
export const renderClickableUrl = (
  url: string, 
  displayText?: string, 
  className?: string
): React.ReactNode => {
  if (!url) return null;
  
  if (!isValidUrl(url)) {
    // If it's not a valid URL, just return the text
    return displayText || url;
  }
  
  const href = normalizeUrl(url);
  
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className || "text-blue-500 hover:text-blue-700 underline"}
      onClick={(e) => e.stopPropagation()} // Prevent modal from closing
    >
      {displayText || url}
    </a>
  );
};