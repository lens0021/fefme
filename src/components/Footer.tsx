import React, { CSSProperties } from "react";
import Container from "react-bootstrap/Container";
import Nav from "react-bootstrap/Nav";
import Navbar from "react-bootstrap/esm/Navbar";

import { config } from "../config";
import { mildlyRoundedCorners, whiteFont } from "../helpers/style_helpers";


/** The footer that appears on the login screen. */
export default function Footer(): JSX.Element {
    return (
        <Navbar expand="lg" className="bg-body-tertiary" bg="dark" data-bs-theme="dark" style={footerNav}>
            <Container>
                <Nav className="me-auto">
                    <Nav.Link href={config.app.repoUrl} style={whiteFont}>
                        <img
                            alt="Github Logo"
                            className="d-inline-block align-top"
                            src="https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png"
                            style={elementStyle}
                        />

                        <span className="p-2">Fefme</span>
                    </Nav.Link>

                    <Nav.Link href="https://github.com/michelcrypt4d4mus/fedialgo" style={whiteFont}>
                        <img
                            alt="Github Logo"
                            className="d-inline-block align-top"
                            src="https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png"
                            style={elementStyle}
                        />

                        <span className="p-2">FediAlgo</span>
                    </Nav.Link>
                </Nav>
            </Container>
        </Navbar>
    );
};


const elementStyle: CSSProperties = {
    ...mildlyRoundedCorners,
    height: 20,
    width: 20,
};

const footerNav: CSSProperties = {
    marginTop: '50px',
};
