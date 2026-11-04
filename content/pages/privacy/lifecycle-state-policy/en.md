---
title: Lifecycle State Policy
description: This Lifecycle State Policy describes the assignment and transition of Lifecycle States and sanctions for a violation of this policy. It supplements the Terms and Conditions.
lastUpdated: '2026-11-04'
---

# Lifecycle State Policy

**For the usage of the Data Portal** <br>
_Version: August 2026_

## Content

- [1. Objective and scope](#1-objective-and-scope)
- [2. Definitions](#2-definitions)
- [3. Service Offering Lifecycle States](#3-service-offering-lifecycle-states)
- [4. Transition of Lifecycle States](#4-transition-of-lifecycle-states)
- [5. Sanctions](#5-sanctions)

---

## 1. Objective and scope

The Lifecycle State Policy describes the assignment and transition of one Lifecycle State to another and sanctions for a violation of this policy. This policy supplements the Terms and Conditions available at [Terms and Conditions](/privacy/terms), as updated from time to time, between Customer and Universitat de Lleida (in the following “Data Portal Provider”), which governs the Customer’s access to and use of the Data Portal.

As outlined in the Terms and Conditions, **all Customers are bound by this policy**.

## 2. Definitions

Capitalized terms shall have the meaning given to them in the Terms and Conditions.

## 3. Service Offering Lifecycle States

Service Offerings are subject to the Service Lifecycle Management, a mechanism to change the visibility of any Service Offering from the Data Portal depending on the Lifecycle State. The Lifecycle State has implications on how the Service Offering is displayed in the Data Portal, and what actions are permitted to be performed regarding the Service Offering.

### 3.1 Set by the Publisher

The Lifecycle State is set by the Publisher and enforced via smart contracts. Lifecycle State means the following properties of metadata describing the state of Service Offerings throughout their lifecycles.

- **Active:** The default state upon initial publication. Service Offerings in the "Active" state are fully functional and available for discovery on the Data Portal. Customers can search for, view, and interact with these Service Offerings. Consumption is allowed.
- **End-of-Life:** Service Offerings in the „End-of-Life“ state remain discoverable, but Consumption is not allowed. This state indicates that the Service Offerings are usually deprecated or outdated, and they are no longer actively promoted or maintained.
- **Deprecated:** This state indicates that another Service Offering has deprecated the current Service Offering. Deprecated Service Offerings are not discoverable, and Consumption is not allowed. Similar to the "End-of-life" state, deprecated Service Offerings are not listed under the Customer’s profile.
- **Revoked:** When a Service Offering is revoked by its Publisher, it means that the Publisher has explicitly revoked access or ownership rights to the Service Offering. Revoked Service Offerings are not discoverable, and Consumption is not allowed.
- **Consumption is temporary disabled:** Service Offerings in this state are still discoverable, but Consumption is temporarily disabled. These Service Offerings are still listed under the Customer's profile.
- **Unlisted:** A state describing a Service Offering which is not visible on the Data Portal, but Consumption is allowed.

The Lifecycle States set by the Publisher have the following properties:

| Lifecycle State | Description                    | Discoverable on Data Portal | Consumption allowed | Listed under account | Reversible |
| :-------------- | :----------------------------- | :-------------------------- | :------------------ | :------------------- | :--------- |
| 0               | Active                         | Yes                         | Yes                 | Yes                  | Yes        |
| 1               | End-of-life                    | Yes                         | No                  | No                   | Yes        |
| 2               | Deprecated                     | No                          | No                  | No                   | No         |
| 3               | Revoked                        | No                          | No                  | No                   | No         |
| 4               | Consumption temporary disabled | Yes                         | No                  | Yes                  | Yes        |
| 5               | Unlisted                       | No                          | Yes                 | Yes                  | Yes        |

### 3.2 Set by the Data Portal Provider

The Lifecycle State set by the Data Portal Provider has implications for how the Service Offering is displayed on the Data Portal, and what actions are permitted to be performed on the Data Portal regarding the Service Offering.

| Lifecycle State | Discoverable on Data Portal | Consumption on Data Portal allowed | Listed under account | Reversible |
| :-------------- | :-------------------------- | :--------------------------------- | :------------------- | :--------- |
| Listed          | Yes                         | Yes                                | Yes                  | Yes        |
| Delisted        | No                          | No                                 | Yes                  | Yes        |

## 4. Transition of Lifecycle States

### 4.1 Initiation by a Publisher

- 4.1.1 Publishers have the right to change the Lifecycle State of Service Offerings by changing the metadata of the respective Service Offering, except 4.1.2 applies.
- 4.1.2 Publishers do not have the right to put a Service Offering into the following states if there are open or ongoing obligations towards Customers who obtained a consumption right: End-of-Life, Deprecated, Revoked.

### 4.2 Initiation by a Customer who is not the Publisher

The Lifecycle State transition of a registered Service Offering to the states Listed/Delisted can be requested from the Data Portal Provider by any Customer. The decision to accept the request and the actual implementation of the transition is the responsibility of the Data Portal Provider.

Customers can place a request including but not limited to the following cases:

- The Service Offering description contains sensitive data including Personal Data.
- The Service Offering contains sensitive or Personal Data without permission or legal basis.
- There is a potential intellectual property (IP) violation.
- There is a suspected or confirmed infringement with applicable law (including GDPR infringements) in the jurisdiction of the Data Portal Provider.

### 4.3 Initiation by the Data Portal Provider

Regardless of whether a report has been filed, Data Portal Providers have the right to change the Lifecycle State of Service Offerings to Listed/Delisted including but not limited to the following cases:

- The Service Offering and/or a Customer Account is corrupted, stolen, or outdated.
- The proper functionality of the Data Portal is at risk.
- The Service Offering description/metadata contains sensitive data including Personal Data.
- The Service Offering contains sensitive or Personal Data without permission or legal basis.
- There is a potential intellectual property (IP) violation.
- The Service Offering is not holding up to the description or promise.
- There is a suspected or confirmed infringement with applicable law (including GDPR infringements) in the jurisdiction of the Data Portal Provider.

## 5. Sanctions

Depending on the nature and severity of the violation of this policy and related documents, violators will be subject to the following sanctions.

| Severity | Description                                                                                                                      | Sanction                                                                                                                          |
| :------- | :------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------- |
| 1        | One-time and minor non-compliance.                                                                                               | Revocation of the affected Service Offering(s).                                                                                   |
| 2        | Repeated minor non-compliance.                                                                                                   | Revocation of the affected Service Offering(s).<br>Additional sanctions depend on the specific case.                              |
| 3        | Involuntary (provable by the accused) and serious non-compliance.                                                                | Revocation of the affected Service Offering(s).<br>Legal consequences, if applicable.                                             |
| 4        | Intentional and serious non-compliance (e.g., publishing of illegal content) or repeated involuntary and serious non-compliance. | Revocation of the affected Service Offering(s).<br>Permanent block of the Customer Account.<br>Legal consequences, if applicable. |
