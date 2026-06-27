import { createNavigation } from 'next-intl/navigation';
import { routing } from '@markaz/i18n';

/** Locale-aware Link / redirect / router for the web app. */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
