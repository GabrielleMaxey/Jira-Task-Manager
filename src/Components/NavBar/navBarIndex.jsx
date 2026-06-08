/* eslint-disable react/prop-types */
import React, { useState, useEffect } from 'react';
import { IconContext } from 'react-icons/lib'
import { animateScroll as scroll } from 'react-scroll';
import { Nav, NavLink, Bars, NavMenu, MobileIcon, NavLogo, NavLogoIcon, NavBarContainer, NavItem, NavLinkRoute } from './navbarElements';

//header video obtained from pexels.com*//

const NavBar = ({ toggle }) => {
    const [scrollNav, setScrollNav] = useState(false);
    const changeNav = () => {
        if(window.scrollY >= 5) {
            setScrollNav(true);
        } else {
            setScrollNav(false);
        }
    };
    useEffect(() => {
        window.addEventListener('scroll', changeNav);
    }, []);

    const toggleHome = () => {
        scroll.scrollToTop();
        };

    return  (
<>
    <IconContext.Provider value={{ color: '#121213' }}>
        <Nav scrollNav={ scrollNav }>
            <NavBarContainer>
                <NavLogo to='/' onClick={ toggleHome }>
                    <NavLogoIcon aria-hidden='true'>🤹</NavLogoIcon>
                    Task Manager
                </NavLogo>
                    <MobileIcon onClick={ toggle }>
                            <Bars />
                    </MobileIcon>
                        <NavMenu>
                            {/* <NavItem>
                                <NavLink to="about" smooth="true" duration={500} spy='true' exact='true' offset={ -80 } > Pick Focus </NavLink>
                            </NavItem> */}
                            {/* <NavItem>
                                <NavLink to="/" smooth="true" duration={500} spy='true' exact='true' offset={ -80 } > Work Time </NavLink>
                            </NavItem>
                            <NavItem>
                                <NavLink to="/" smooth="true" duration={500} spy= 'true' exact='true' offset={ -80 }> Data </NavLink>
                            </NavItem>
                            <NavItem>
                                <NavLinkRoute to="/" smooth={true}  duration={500} spy= 'true' exact='true' offset={ -80 }> Jira </NavLinkRoute>
                            </NavItem> */}
                        </NavMenu>
                </NavBarContainer>
            </Nav>
        </IconContext.Provider>
</>

);
};

export default NavBar;