import React, { useState, useEffect } from 'react';
import {GiRocketThruster } from "react-icons/gi"
import {FaTimes } from "react-icons/fa"
import { Link } from "react-router-dom";
import { Nav, NavLink, Bars, NavMenu, MobileIcon, NavLogo, NavBarContainer, NavItem, NavLinkRoute } from './navbarElements.js';

function NavBar() {
	const [click, setClick] = useState(false)
	
	const handleClick = () => setClick(!click)
	const closeMobileMenu = () => setClick(false)
	return(
		<>
		<nav className="navbar">
		<div className="navbar-container container">
		<Link to="/" className="navbar-logo">
			<GiRocketThruster className="navbar-icon"  onClick={closeMobileMenu} />
			TESTING
		</Link>
		<div className="menu-icon" onClick={handleClick}>
			{click ? <FaTimes /> : <Bars />}
		</div>
		<ul className={ click ? "nav-men active" : "nav-menu"}>
			<li className="nav-item">
				<NavLink to="/" className={({ isActive })=> "nav-links" + (isActive ? " activated" : "")}>
					
				</NavLink>
			</li>
		</ul>
		</div>
		</nav>
		</>
	)
}
export default NavBar;