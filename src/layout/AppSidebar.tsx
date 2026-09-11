"use client";
import { usePermission } from "@/context/PermissionContext";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSidebar } from "../context/SidebarContext";
import {
  BoxCubeIcon,
  ChevronDownIcon,
  DocsIcon,
  DollarLineIcon,
  GridIcon,
  HorizontaLDots,
  TableIcon,
  TaskIcon,
  UserCircleIcon,
} from "../icons/index";
import SidebarWidget from "./SidebarWidget";

type NavItem = {
  name: string;
  icon: React.ReactNode;
  path?: string;
  resource?: string;
  subItems?: { name: string; path: string; resource: string }[];
};

type MenuType = "main";

const navItems: NavItem[] = [
  {
    icon: <GridIcon />,
    name: "Dashboard",
    path: "/",
    resource: "dashboard",
  },
  {
    name: "Danh mục",
    icon: <BoxCubeIcon />,
    subItems: [
      { name: "Khách hàng", path: "/danh-muc/khach-hang", resource: "customer" },
      { name: "Đơn vị vận tải", path: "/danh-muc/don-vi-van-tai", resource: "vendor" },
      { name: "Xe", path: "/danh-muc/xe", resource: "vehicle" },
      { name: "Tài xế", path: "/danh-muc/tai-xe", resource: "driver" },
      { name: "Điểm nâng / hạ", path: "/danh-muc/diem-nang-ha", resource: "location" },
      { name: "Hàng hóa", path: "/danh-muc/hang-hoa", resource: "product" },
      { name: "Loại chi phí", path: "/danh-muc/loai-chi-phi", resource: "cost-type" },
    ],
  },
  {
    name: "Vận tải",
    icon: <TaskIcon />,
    subItems: [{ name: "Nhật trình / Chuyến xe", path: "/van-tai/nhat-trinh", resource: "trip" }],
  },
  {
    name: "Kinh doanh",
    icon: <TableIcon />,
    subItems: [{ name: "Bảng giá vận chuyển", path: "/kinh-doanh/bang-gia", resource: "price" }],
  },
  {
    name: "Tài chính",
    icon: <DollarLineIcon />,
    subItems: [
      { name: "Thu - Chi", path: "/tai-chinh/thu-chi", resource: "finance" },
      { name: "Lương tài xế", path: "/tai-chinh/luong-tai-xe", resource: "payroll" },
    ],
  },
  {
    name: "Công nợ",
    icon: <DocsIcon />,
    subItems: [
      { name: "Công nợ khách hàng", path: "/cong-no/khach-hang", resource: "receivable" },
      { name: "Công nợ đơn vị vận tải", path: "/cong-no/don-vi-van-tai", resource: "payable" },
    ],
  },
  {
    name: "Hệ thống",
    icon: <UserCircleIcon />,
    subItems: [
      { name: "Người dùng", path: "/he-thong/nguoi-dung", resource: "user" },
      { name: "Import Excel", path: "/he-thong/import-excel", resource: "import" },
    ],
  },
];

const getNavKey = (menuType: MenuType, nav: NavItem) => `${menuType}-${nav.name.replace(/\s+/g, "-").toLowerCase()}`;

const AppSidebar: React.FC = () => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const pathname = usePathname();
  const { can } = usePermission();

  const hasViewPermission = useCallback((resource: string | undefined) => (resource ? can(resource, "VIEW") : true), [can]);

  const filteredNavItems = useMemo(() => {
    return navItems
      .map((nav) => {
        if (nav.subItems) {
          const filteredSubItems = nav.subItems.filter((sub) => hasViewPermission(sub.resource));
          return filteredSubItems.length > 0 ? { ...nav, subItems: filteredSubItems } : null;
        } else if (nav.path) {
          return hasViewPermission(nav.resource) ? nav : null;
        }
        return null;
      })
      .filter(Boolean) as NavItem[];
  }, [hasViewPermission]);

  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null);
  const [subMenuHeight, setSubMenuHeight] = useState<Record<string, number>>({});
  const subMenuRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const isActive = useCallback((path: string) => path === pathname, [pathname]);

  const handleSubmenuToggle = (navKey: string) => {
    setOpenSubmenu((prev) => (prev === navKey ? null : navKey));
  };

  const renderMenuItems = (items: NavItem[], menuType: MenuType) => (
    <ul className="flex flex-col gap-4">
      {items.map((nav) => {
        const navKey = getNavKey(menuType, nav);

        return (
          <li key={navKey}>
            {nav.subItems ? (
              <button
                onClick={() => handleSubmenuToggle(navKey)}
                className={`menu-item group ${openSubmenu === navKey ? "menu-item-active" : "menu-item-inactive"} cursor-pointer ${
                  !isExpanded && !isHovered ? "lg:justify-center" : "lg:justify-start"
                }`}
              >
                <span className={`${openSubmenu === navKey ? "menu-item-icon-active" : "menu-item-icon-inactive"}`}>{nav.icon}</span>
                {(isExpanded || isHovered || isMobileOpen) && <span className="menu-item-text">{nav.name}</span>}
                {(isExpanded || isHovered || isMobileOpen) && (
                  <ChevronDownIcon
                    className={`ml-auto w-5 h-5 transition-transform duration-200 ${openSubmenu === navKey ? "rotate-180 text-brand-500" : ""}`}
                  />
                )}
              </button>
            ) : (
              nav.path && (
                <Link href={nav.path} className={`menu-item group ${isActive(nav.path) ? "menu-item-active" : "menu-item-inactive"}`}>
                  <span className={`${isActive(nav.path) ? "menu-item-icon-active" : "menu-item-icon-inactive"}`}>{nav.icon}</span>
                  {(isExpanded || isHovered || isMobileOpen) && <span className="menu-item-text">{nav.name}</span>}
                </Link>
              )
            )}

            {nav.subItems && (isExpanded || isHovered || isMobileOpen) && (
              <div
                ref={(el) => {
                  subMenuRefs.current[navKey] = el;
                }}
                className="overflow-hidden transition-all duration-300"
                style={{ height: openSubmenu === navKey ? `${subMenuHeight[navKey] ?? 0}px` : "0px" }}
              >
                <ul className="mt-2 space-y-1 ml-9">
                  {nav.subItems.map((subItem) => (
                    <li key={subItem.name}>
                      <Link
                        href={subItem.path}
                        className={`menu-dropdown-item ${isActive(subItem.path) ? "menu-dropdown-item-active" : "menu-dropdown-item-inactive"}`}
                      >
                        {subItem.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );

  useEffect(() => {
    let matchedKey: string | null = null;

    filteredNavItems.forEach((nav) => {
      if (nav.subItems) {
        nav.subItems.forEach((subItem) => {
          if (isActive(subItem.path)) {
            matchedKey = getNavKey("main", nav);
          }
        });
      }
    });

    if (matchedKey) {
      setOpenSubmenu(matchedKey);
    } else if (openSubmenu) {
      const stillExists = filteredNavItems.some((nav) => getNavKey("main", nav) === openSubmenu);
      if (!stillExists) {
        setOpenSubmenu(null);
        setSubMenuHeight({});
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, filteredNavItems, isActive]);

  useEffect(() => {
    if (openSubmenu) {
      const el = subMenuRefs.current[openSubmenu];
      if (el) {
        setSubMenuHeight((prev) => ({ ...prev, [openSubmenu]: el.scrollHeight }));
      }
    }
  }, [openSubmenu]);

  return (
    <aside
      className={`fixed mt-16 flex flex-col lg:mt-0 top-0 px-5 left-0 bg-white dark:bg-gray-900 dark:border-gray-800 text-gray-900 h-screen transition-all duration-300 ease-in-out z-50 border-r border-gray-200
        ${isExpanded || isMobileOpen ? "w-[290px]" : isHovered ? "w-[290px]" : "w-[90px]"}
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0`}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={`py-8 flex ${!isExpanded && !isHovered ? "lg:justify-center" : "justify-start"}`}>
        <Link href="/">
          {isExpanded || isHovered || isMobileOpen ? (
            <>
              <Image className="dark:hidden" src="/images/logo/logo.svg" alt="Đại Phát" width={150} height={40} />
              <Image className="hidden dark:block" src="/images/logo/logo-dark.svg" alt="Đại Phát" width={150} height={40} />
            </>
          ) : (
            <Image src="/images/logo/logo-icon.svg" alt="Đại Phát" width={32} height={32} />
          )}
        </Link>
      </div>

      <div className="flex flex-col overflow-y-auto duration-300 ease-linear no-scrollbar">
        <nav className="mb-6">
          <div className="flex flex-col gap-4">
            <div>
              <h2
                className={`mb-4 text-xs uppercase flex leading-[20px] text-gray-400 ${
                  !isExpanded && !isHovered ? "lg:justify-center" : "justify-start"
                }`}
              >
                {isExpanded || isHovered || isMobileOpen ? "Menu" : <HorizontaLDots />}
              </h2>
              {renderMenuItems(filteredNavItems, "main")}
            </div>
          </div>
        </nav>

        {isExpanded || isHovered || isMobileOpen ? <SidebarWidget /> : null}
      </div>
    </aside>
  );
};

export default AppSidebar;
