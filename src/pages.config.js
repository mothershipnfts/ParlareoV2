/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import AdminDashboard from './pages/AdminDashboard';
import BookLessons from './pages/BookLessons';
import BrowseTeachers from './pages/BrowseTeachers';
import BuyLessonPackage from './pages/BuyLessonPackage';
import Home from './pages/Home';
import LessonRoom from './pages/LessonRoom';
import LessonStore from './pages/LessonStore';
import ManageSchedule from './pages/ManageSchedule';
import MyLessons from './pages/MyLessons';
import PDFLessonStore from './pages/PDFLessonStore';
import PDFViewer from './pages/PDFViewer';
import Packages from './pages/Packages';
import PlacementTest from './pages/PlacementTest';
import StudentDashboard from './pages/StudentDashboard';
import StudentLessons from './pages/StudentLessons';
import StudentPayment from './pages/StudentPayment';
import TeacherDashboard from './pages/TeacherDashboard';
import TeacherPendingReview from './pages/TeacherPendingReview';
import TeacherProfile from './pages/TeacherProfile';
import TeacherProfileEdit from './pages/TeacherProfileEdit';
import TeacherRejected from './pages/TeacherRejected';
import TeacherSignup from './pages/TeacherSignup';
import TeacherWallet from './pages/TeacherWallet';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AdminDashboard": AdminDashboard,
    "BookLessons": BookLessons,
    "BrowseTeachers": BrowseTeachers,
    "BuyLessonPackage": BuyLessonPackage,
    "Home": Home,
    "LessonRoom": LessonRoom,
    "LessonStore": LessonStore,
    "ManageSchedule": ManageSchedule,
    "MyLessons": MyLessons,
    "PDFLessonStore": PDFLessonStore,
    "PDFViewer": PDFViewer,
    "Packages": Packages,
    "PlacementTest": PlacementTest,
    "StudentDashboard": StudentDashboard,
    "StudentLessons": StudentLessons,
    "StudentPayment": StudentPayment,
    "TeacherDashboard": TeacherDashboard,
    "TeacherPendingReview": TeacherPendingReview,
    "TeacherProfile": TeacherProfile,
    "TeacherProfileEdit": TeacherProfileEdit,
    "TeacherRejected": TeacherRejected,
    "TeacherSignup": TeacherSignup,
    "TeacherWallet": TeacherWallet,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};