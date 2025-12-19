// src/config/categories.js

import menuHousing from "/menu/residential.png";
import menuProduction from "/menu/production.png";
import menuGoods from "/menu/goods.png";
import menuCulture from "/menu/culture.png";
import menuDecoration from "/menu/decoration.png";
import menuMilitary from "/menu/military.png";

import culture from "../data/culture.json";
import decoration from "../data/decoration.json";
import goods from "../data/goods.json";
import housing from "../data/housing.json";
import military from "../data/military.json";
import production from "../data/production.json";
import townhall from "../data/townhall.json";

export const categories = [
  { key: "housing", label: "Housing", data: housing, icon: menuHousing },
  {
    key: "production",
    label: "Production",
    data: production,
    icon: menuProduction,
  },
  { key: "goods", label: "Goods", data: goods, icon: menuGoods },
  { key: "culture", label: "Culture", data: culture, icon: menuCulture },
  {
    key: "decoration",
    label: "Decoration",
    data: decoration,
    icon: menuDecoration,
  },
  { key: "military", label: "Military", data: military, icon: menuMilitary },
  {
    key: "townhall",
    label: "Townhall",
    data: townhall,
    icon: menuHousing,
    hidden: true,
  },
];

export const categoryColors = {
  housing: "#e2b93b",
  production: "#7ac25f",
  goods: "#4ab1ff",
  culture: "#a05cff",
  decoration: "#ff7f50",
  military: "#d84848",
  townhall: "#6c8da8",
};
