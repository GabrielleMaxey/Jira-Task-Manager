import React from 'react';
import { Link } from "react-router-dom";
import "./Home.css";

const Home = () => {
    return (
            <section className="home-page">
                <h1>HOME PAGE</h1>
                <p>
                    Open Task Manager here:{" "}
                    <Link className="home-link" to="/work-week">
                        Task Manager
                    </Link>
                </p>
            </section>
    );
};

export default Home;