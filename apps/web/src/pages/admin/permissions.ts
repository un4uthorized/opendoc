/**
 * What each person sees in the admin panel. Owners and project admins see everything in a project;
 * editors only the content screens (overview, API and versions, wiki), and the API refuses the rest.
 */
import type { ProjectSection } from './router';
import type { Project } from './data/types';

const contentSections: ProjectSection[] = ['overview', 'spec', 'versions', 'pages'];

/** Members, settings, appearance, history and analytics. */
export const canManage = (project: Project) => project.access === 'owner' || project.access === 'admin';

export const canSee = (project: Project, section: ProjectSection) => canManage(project) || contentSections.includes(section);
